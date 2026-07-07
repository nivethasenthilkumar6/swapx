import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SwapRouter, MockERC20, WETH9 } from "../typechain-types";

describe("SwapRouter", function () {
  let swapRouter: SwapRouter;
  let weth: WETH9;
  let usdc: MockERC20;
  let dai: MockERC20;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let uniswapRouter: any;
  let uniswapFactory: any;

  const USDC_AMOUNT = 200000n * 10n ** 6n;
  const ETH_AMOUNT = ethers.parseEther("100");
  const DAI_AMOUNT = ethers.parseEther("200000");

  beforeEach(async function () {
    [owner, user, feeRecipient] = await ethers.getSigners();

    // Deploy WETH
    const WETH9Factory = await ethers.getContractFactory("WETH9");
    weth = await WETH9Factory.deploy();

    // Deploy Uniswap V2 Factory
    const UniswapV2Factory = await ethers.getContractFactory(
      require("@uniswap/v2-core/build/UniswapV2Factory.json").abi,
      require("@uniswap/v2-core/build/UniswapV2Factory.json").bytecode
    );
    uniswapFactory = await UniswapV2Factory.deploy(owner.address);

    // Deploy Uniswap V2 Router
    const UniswapV2Router02 = await ethers.getContractFactory(
      require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi,
      require("@uniswap/v2-periphery/build/UniswapV2Router02.json").bytecode
    );
    uniswapRouter = await UniswapV2Router02.deploy(
      await uniswapFactory.getAddress(),
      await weth.getAddress()
    );

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20Factory.deploy("USD Coin", "USDC", 6);
    dai = await MockERC20Factory.deploy("Dai Stablecoin", "DAI", 18);

    // Deploy SwapRouter
    const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
    swapRouter = await SwapRouterFactory.deploy(
      await uniswapRouter.getAddress(),
      feeRecipient.address
    );

    // Mint tokens
    await usdc.mint(owner.address, USDC_AMOUNT * 2n);
    await dai.mint(owner.address, DAI_AMOUNT * 2n);
    await usdc.mint(user.address, USDC_AMOUNT);
    await dai.mint(user.address, DAI_AMOUNT);

    // Approve and seed liquidity
    const routerAddr = await uniswapRouter.getAddress();
    await usdc.approve(routerAddr, ethers.MaxUint256);
    await dai.approve(routerAddr, ethers.MaxUint256);

    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Seed ETH/USDC pool
    await uniswapRouter.addLiquidityETH(
      await usdc.getAddress(),
      USDC_AMOUNT, 0, 0,
      owner.address,
      deadline,
      { value: ETH_AMOUNT }
    );

    // Seed ETH/DAI pool
    await uniswapRouter.addLiquidityETH(
      await dai.getAddress(),
      DAI_AMOUNT, 0, 0,
      owner.address,
      deadline,
      { value: ETH_AMOUNT }
    );
  });

  describe("Deployment", function () {
    it("Should set the correct router", async function () {
      expect(await swapRouter.uniswapRouter()).to.equal(await uniswapRouter.getAddress());
    });

    it("Should set the correct factory", async function () {
      expect(await swapRouter.uniswapFactory()).to.equal(await uniswapFactory.getAddress());
    });

    it("Should set the correct WETH", async function () {
      expect(await swapRouter.WETH()).to.equal(await weth.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await swapRouter.owner()).to.equal(owner.address);
    });

    it("Should set default protocol fee", async function () {
      expect(await swapRouter.protocolFeeBps()).to.equal(5);
    });

    it("Should reject zero address router", async function () {
      const SwapRouterFactory = await ethers.getContractFactory("SwapRouter");
      await expect(
        SwapRouterFactory.deploy(ethers.ZeroAddress, feeRecipient.address)
      ).to.be.revertedWithCustomError(swapRouter, "ZeroAddress");
    });
  });

  describe("swapExactETHForTokens", function () {
    it("Should swap ETH for tokens", async function () {
      const swapAmount = ethers.parseEther("1");
      const path = [await weth.getAddress(), await usdc.getAddress()];

      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const balanceBefore = await usdc.balanceOf(user.address);

      await swapRouter.connect(user).swapExactETHForTokens(
        0, path, user.address, deadline,
        { value: swapAmount }
      );

      const balanceAfter = await usdc.balanceOf(user.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should collect protocol fee in ETH", async function () {
      const swapAmount = ethers.parseEther("1");
      const path = [await weth.getAddress(), await usdc.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const feeBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

      await swapRouter.connect(user).swapExactETHForTokens(
        0, path, user.address, deadline,
        { value: swapAmount }
      );

      const feeBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      expect(feeBalanceAfter).to.be.gt(feeBalanceBefore);
    });

    it("Should emit SwapExecuted event", async function () {
      const swapAmount = ethers.parseEther("1");
      const path = [await weth.getAddress(), await usdc.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        swapRouter.connect(user).swapExactETHForTokens(
          0, path, user.address, deadline,
          { value: swapAmount }
        )
      ).to.emit(swapRouter, "SwapExecuted");
    });

    it("Should revert with zero value", async function () {
      const path = [await weth.getAddress(), await usdc.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        swapRouter.connect(user).swapExactETHForTokens(0, path, user.address, deadline)
      ).to.be.revertedWithCustomError(swapRouter, "ZeroAmount");
    });

    it("Should revert with expired deadline", async function () {
      const swapAmount = ethers.parseEther("1");
      const path = [await weth.getAddress(), await usdc.getAddress()];

      await expect(
        swapRouter.connect(user).swapExactETHForTokens(
          0, path, user.address, 0,
          { value: swapAmount }
        )
      ).to.be.revertedWithCustomError(swapRouter, "DeadlineExpired");
    });
  });

  describe("swapExactTokensForETH", function () {
    it("Should swap tokens for ETH", async function () {
      const swapAmount = 1000n * 10n ** 6n; // 1000 USDC
      const path = [await usdc.getAddress(), await weth.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await usdc.connect(user).approve(await swapRouter.getAddress(), swapAmount);

      const ethBefore = await ethers.provider.getBalance(user.address);

      const tx = await swapRouter.connect(user).swapExactTokensForETH(
        swapAmount, 0, path, user.address, deadline
      );
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const ethAfter = await ethers.provider.getBalance(user.address);
      expect(ethAfter + gasCost).to.be.gt(ethBefore);
    });
  });

  describe("swapExactTokensForTokens", function () {
    it("Should swap tokens for tokens via WETH", async function () {
      const swapAmount = 1000n * 10n ** 6n; // 1000 USDC
      const path = [
        await usdc.getAddress(),
        await weth.getAddress(),
        await dai.getAddress(),
      ];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await usdc.connect(user).approve(await swapRouter.getAddress(), swapAmount);

      const daiBefore = await dai.balanceOf(user.address);

      await swapRouter.connect(user).swapExactTokensForTokens(
        swapAmount, 0, path, user.address, deadline
      );

      const daiAfter = await dai.balanceOf(user.address);
      expect(daiAfter).to.be.gt(daiBefore);
    });
  });

  describe("View Functions", function () {
    it("Should get amounts out", async function () {
      const amountIn = ethers.parseEther("1");
      const path = [await weth.getAddress(), await usdc.getAddress()];

      const amounts = await swapRouter.getAmountsOut(amountIn, path);
      expect(amounts.length).to.equal(2);
      expect(amounts[1]).to.be.gt(0);
    });

    it("Should get amounts in", async function () {
      const amountOut = 1000n * 10n ** 6n;
      const path = [await weth.getAddress(), await usdc.getAddress()];

      const amounts = await swapRouter.getAmountsIn(amountOut, path);
      expect(amounts.length).to.equal(2);
      expect(amounts[0]).to.be.gt(0);
    });

    it("Should return factory address", async function () {
      expect(await swapRouter.factory()).to.equal(await uniswapFactory.getAddress());
    });
  });

  describe("Admin Functions", function () {
    it("Should update protocol fee", async function () {
      await swapRouter.setProtocolFee(10);
      expect(await swapRouter.protocolFeeBps()).to.equal(10);
    });

    it("Should reject fee too high", async function () {
      await expect(swapRouter.setProtocolFee(100))
        .to.be.revertedWithCustomError(swapRouter, "FeeTooHigh");
    });

    it("Should update fee recipient", async function () {
      await swapRouter.setFeeRecipient(user.address);
      expect(await swapRouter.feeRecipient()).to.equal(user.address);
    });

    it("Should pause and unpause", async function () {
      await swapRouter.pause();
      expect(await swapRouter.paused()).to.be.true;

      await swapRouter.unpause();
      expect(await swapRouter.paused()).to.be.false;
    });

    it("Should block swaps when paused", async function () {
      await swapRouter.pause();
      const path = [await weth.getAddress(), await usdc.getAddress()];
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        swapRouter.connect(user).swapExactETHForTokens(
          0, path, user.address, deadline,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(swapRouter, "EnforcedPause");
    });

    it("Should prevent non-owner from pausing", async function () {
      await expect(swapRouter.connect(user).pause())
        .to.be.revertedWithCustomError(swapRouter, "OwnableUnauthorizedAccount");
    });

    it("Should emergency withdraw ETH", async function () {
      // Send ETH to contract
      await owner.sendTransaction({
        to: await swapRouter.getAddress(),
        value: ethers.parseEther("1"),
      });

      const balBefore = await ethers.provider.getBalance(user.address);
      await swapRouter.emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("1"), user.address);
      const balAfter = await ethers.provider.getBalance(user.address);
      expect(balAfter).to.be.gt(balBefore);
    });
  });
});
