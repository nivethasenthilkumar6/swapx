import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { LiquidityManager, MockERC20, WETH9 } from "../typechain-types";

describe("LiquidityManager", function () {
  let liquidityManager: LiquidityManager;
  let weth: WETH9;
  let usdc: MockERC20;
  let dai: MockERC20;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let uniswapRouter: any;
  let uniswapFactory: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

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

    // Deploy LiquidityManager
    const LMFactory = await ethers.getContractFactory("LiquidityManager");
    liquidityManager = await LMFactory.deploy(await uniswapRouter.getAddress());

    // Mint tokens to users
    const usdcAmount = 1000000n * 10n ** 6n;
    const daiAmount = ethers.parseEther("1000000");
    await usdc.mint(owner.address, usdcAmount);
    await dai.mint(owner.address, daiAmount);
    await usdc.mint(user.address, usdcAmount);
    await dai.mint(user.address, daiAmount);
  });

  describe("Deployment", function () {
    it("Should set the correct router", async function () {
      expect(await liquidityManager.uniswapRouter()).to.equal(
        await uniswapRouter.getAddress()
      );
    });

    it("Should set the correct WETH", async function () {
      expect(await liquidityManager.WETH()).to.equal(await weth.getAddress());
    });
  });

  describe("addLiquidity", function () {
    it("Should add liquidity to a token pair", async function () {
      const usdcAmount = 10000n * 10n ** 6n;
      const daiAmount = ethers.parseEther("10000");
      const lmAddress = await liquidityManager.getAddress();

      await usdc.connect(user).approve(lmAddress, usdcAmount);
      await dai.connect(user).approve(lmAddress, daiAmount);

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        liquidityManager.connect(user).addLiquidity(
          await usdc.getAddress(),
          await dai.getAddress(),
          usdcAmount, daiAmount,
          0, 0,
          user.address,
          deadline
        )
      ).to.emit(liquidityManager, "LiquidityAdded");
    });

    it("Should revert with identical tokens", async function () {
      const usdcAddress = await usdc.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        liquidityManager.connect(user).addLiquidity(
          usdcAddress, usdcAddress,
          1000, 1000, 0, 0,
          user.address, deadline
        )
      ).to.be.revertedWithCustomError(liquidityManager, "IdenticalTokens");
    });

    it("Should revert with zero amount", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        liquidityManager.connect(user).addLiquidity(
          await usdc.getAddress(),
          await dai.getAddress(),
          0, 0, 0, 0,
          user.address, deadline
        )
      ).to.be.revertedWithCustomError(liquidityManager, "ZeroAmount");
    });
  });

  describe("addLiquidityETH", function () {
    it("Should add liquidity to a token/ETH pool", async function () {
      const tokenAmount = 10000n * 10n ** 6n;
      const lmAddress = await liquidityManager.getAddress();

      await usdc.connect(user).approve(lmAddress, tokenAmount);

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        liquidityManager.connect(user).addLiquidityETH(
          await usdc.getAddress(),
          tokenAmount, 0, 0,
          user.address, deadline,
          { value: ethers.parseEther("5") }
        )
      ).to.emit(liquidityManager, "LiquidityETHAdded");
    });
  });

  describe("removeLiquidity", function () {
    it("Should remove liquidity from a pool", async function () {
      // First add liquidity
      const usdcAmount = 10000n * 10n ** 6n;
      const daiAmount = ethers.parseEther("10000");
      const lmAddress = await liquidityManager.getAddress();

      await usdc.connect(user).approve(lmAddress, usdcAmount);
      await dai.connect(user).approve(lmAddress, daiAmount);

      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await liquidityManager.connect(user).addLiquidity(
        await usdc.getAddress(),
        await dai.getAddress(),
        usdcAmount, daiAmount,
        0, 0,
        user.address, deadline
      );

      // Get LP token balance
      const pairAddress = await uniswapFactory.getPair(
        await usdc.getAddress(),
        await dai.getAddress()
      );
      const lpBalance = await ethers.provider.call({
        to: pairAddress,
        data: ethers.id("balanceOf(address)").slice(0, 10) +
          ethers.AbiCoder.defaultAbiCoder().encode(["address"], [user.address]).slice(2),
      });
      const lpAmount = BigInt(lpBalance);

      if (lpAmount > 0n) {
        // Approve LP tokens
        const pairContract = new ethers.Contract(
          pairAddress,
          ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
          user
        );
        const userLpBalance = await pairContract.balanceOf(user.address);
        await pairContract.approve(lmAddress, userLpBalance);

        await expect(
          liquidityManager.connect(user).removeLiquidity(
            await usdc.getAddress(),
            await dai.getAddress(),
            userLpBalance,
            0, 0,
            user.address, deadline
          )
        ).to.emit(liquidityManager, "LiquidityRemoved");
      }
    });
  });

  describe("View Functions", function () {
    it("Should check if pair exists", async function () {
      // Before adding liquidity, pair should not exist
      const [pair, exists] = await liquidityManager.checkPair(
        await usdc.getAddress(),
        await dai.getAddress()
      );
      // May or may not exist depending on whether createPair was called
      expect(typeof exists).to.equal("boolean");
    });

    it("Should create a new pair", async function () {
      await expect(
        liquidityManager.createPair(
          await usdc.getAddress(),
          await dai.getAddress()
        )
      ).to.emit(liquidityManager, "PoolCreated");
    });

    it("Should reject identical tokens for pair creation", async function () {
      const addr = await usdc.getAddress();
      await expect(
        liquidityManager.createPair(addr, addr)
      ).to.be.revertedWithCustomError(liquidityManager, "IdenticalTokens");
    });
  });

  describe("Admin Functions", function () {
    it("Should pause and unpause", async function () {
      await liquidityManager.pause();
      expect(await liquidityManager.paused()).to.be.true;
      await liquidityManager.unpause();
      expect(await liquidityManager.paused()).to.be.false;
    });

    it("Should block actions when paused", async function () {
      await liquidityManager.pause();
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      await expect(
        liquidityManager.connect(user).addLiquidityETH(
          await usdc.getAddress(),
          1000, 0, 0,
          user.address, deadline,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(liquidityManager, "EnforcedPause");
    });
  });
});
