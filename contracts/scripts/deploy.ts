import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

interface DeployedAddresses {
  network: string;
  chainId: number;
  deployer: string;
  timestamp: string;
  contracts: {
    WETH: string;
    UniswapFactory: string;
    UniswapRouter: string;
    SwapRouter: string;
    SwapHelper: string;
    LiquidityManager: string;
    tokens: {
      USDC: string;
      DAI: string;
      LINK: string;
      UNI: string;
      WBTC: string;
    };
    pairs: {
      [key: string]: string;
    };
  };
}

// ─── Helper: update (or insert) a key=value line in a .env file ──────────────
function updateEnvFile(envPath: string, updates: Record<string, string>): void {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content += `\n${line}`;
    }
  }

  fs.writeFileSync(envPath, content, "utf8");
  console.log(`   ✓ Updated ${envPath}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  SwapX Deployment Script");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:  ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("═══════════════════════════════════════════════════════\n");

  // ─── Step 1: Deploy WETH ──────────────────────────────────────────
  console.log("1. Deploying WETH9...");
  const WETH9 = await ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log(`   ✓ WETH9 deployed at: ${wethAddress}\n`);

  // ─── Step 2: Deploy Uniswap V2 Factory ────────────────────────────
  console.log("2. Deploying Uniswap V2 Factory...");
  const UniswapV2Factory = await ethers.getContractFactory(
    require("@uniswap/v2-core/build/UniswapV2Factory.json").abi,
    require("@uniswap/v2-core/build/UniswapV2Factory.json").bytecode
  );
  const factory = await UniswapV2Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`   ✓ Factory deployed at: ${factoryAddress}\n`);

  // ─── Step 3: Deploy Uniswap V2 Router02 ───────────────────────────
  console.log("3. Deploying Uniswap V2 Router02...");
  const UniswapV2Router02 = await ethers.getContractFactory(
    require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi,
    require("@uniswap/v2-periphery/build/UniswapV2Router02.json").bytecode
  );
  const router = await UniswapV2Router02.deploy(factoryAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`   ✓ Router02 deployed at: ${routerAddress}\n`);

  // ─── Step 4: Deploy Mock Tokens ───────────────────────────────────
  console.log("4. Deploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  console.log(`   ✓ USDC:  ${await usdc.getAddress()}`);

  const dai = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
  await dai.waitForDeployment();
  console.log(`   ✓ DAI:   ${await dai.getAddress()}`);

  const link = await MockERC20.deploy("Chainlink", "LINK", 18);
  await link.waitForDeployment();
  console.log(`   ✓ LINK:  ${await link.getAddress()}`);

  const uni = await MockERC20.deploy("Uniswap", "UNI", 18);
  await uni.waitForDeployment();
  console.log(`   ✓ UNI:   ${await uni.getAddress()}`);

  const wbtc = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
  await wbtc.waitForDeployment();
  console.log(`   ✓ WBTC:  ${await wbtc.getAddress()}\n`);

  // ─── Step 5: Deploy SwapX Contracts ───────────────────────────────
  console.log("5. Deploying SwapX Contracts...");

  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  const swapRouter = await SwapRouter.deploy(routerAddress, deployer.address);
  await swapRouter.waitForDeployment();
  console.log(`   ✓ SwapRouter:        ${await swapRouter.getAddress()}`);

  const SwapHelper = await ethers.getContractFactory("SwapHelper");
  const swapHelper = await SwapHelper.deploy(routerAddress);
  await swapHelper.waitForDeployment();
  console.log(`   ✓ SwapHelper:        ${await swapHelper.getAddress()}`);

  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(routerAddress);
  await liquidityManager.waitForDeployment();
  console.log(`   ✓ LiquidityManager:  ${await liquidityManager.getAddress()}\n`);

  // ─── Step 6: Mint Test Tokens ─────────────────────────────────────
  console.log("6. Minting test tokens to deployer...");
  const mintAmount18 = ethers.parseEther("1000000");    // 1M tokens (18 decimals)
  const mintAmountUSDC = 1000000n * 10n ** 6n;          // 1M USDC (6 decimals)
  const mintAmountWBTC = 1000000n * 10n ** 8n;          // 1M WBTC (8 decimals)

  await (await usdc.mint(deployer.address, mintAmountUSDC)).wait();
  await (await dai.mint(deployer.address, mintAmount18)).wait();
  await (await link.mint(deployer.address, mintAmount18)).wait();
  await (await uni.mint(deployer.address, mintAmount18)).wait();
  await (await wbtc.mint(deployer.address, mintAmountWBTC)).wait();
  console.log("   ✓ Minted 1,000,000 of each token\n");

  // ─── Step 7: Create Pairs & Seed Liquidity ────────────────────────
  console.log("7. Creating pairs and seeding liquidity...");

  // Approve router for all tokens
  const maxApproval = ethers.MaxUint256;
  await (await usdc.approve(routerAddress, maxApproval)).wait();
  await (await dai.approve(routerAddress, maxApproval)).wait();
  await (await link.approve(routerAddress, maxApproval)).wait();
  await (await uni.approve(routerAddress, maxApproval)).wait();
  await (await wbtc.approve(routerAddress, maxApproval)).wait();

  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const routerContract = new ethers.Contract(
    routerAddress,
    require("@uniswap/v2-periphery/build/UniswapV2Router02.json").abi,
    deployer
  );

  // ETH/USDC pair (1 ETH = 2000 USDC)
  const usdcForPair = 100n * 10n ** 6n; // 100 USDC
  const ethForUsdcPair = ethers.parseEther("0.05"); // 0.05 ETH
  await (await routerContract.addLiquidityETH(
    await usdc.getAddress(), usdcForPair, 0, 0, deployer.address, deadline,
    { value: ethForUsdcPair }
  )).wait();
  console.log("   ✓ ETH/USDC pool seeded (0.05 ETH / 100 USDC)");

  // ETH/DAI pair (1 ETH = 2000 DAI)
  const daiForPair = ethers.parseEther("100"); // 100 DAI
  const ethForDaiPair = ethers.parseEther("0.05"); // 0.05 ETH
  await (await routerContract.addLiquidityETH(
    await dai.getAddress(), daiForPair, 0, 0, deployer.address, deadline,
    { value: ethForDaiPair }
  )).wait();
  console.log("   ✓ ETH/DAI pool seeded (0.05 ETH / 100 DAI)");

  // ETH/LINK pair (1 ETH = 100 LINK)
  const linkForPair = ethers.parseEther("5"); // 5 LINK
  const ethForLinkPair = ethers.parseEther("0.05"); // 0.05 ETH
  await (await routerContract.addLiquidityETH(
    await link.getAddress(), linkForPair, 0, 0, deployer.address, deadline,
    { value: ethForLinkPair }
  )).wait();
  console.log("   ✓ ETH/LINK pool seeded (0.05 ETH / 5 LINK)");

  // USDC/DAI pair (1:1 stablecoin)
  const usdcForStable = 50n * 10n ** 6n; // 50 USDC
  const daiForStable = ethers.parseEther("50"); // 50 DAI
  await (await routerContract.addLiquidity(
    await usdc.getAddress(), await dai.getAddress(),
    usdcForStable, daiForStable, 0, 0, deployer.address, deadline
  )).wait();
  console.log("   ✓ USDC/DAI pool seeded (50 USDC / 50 DAI)\n");

  // ─── Step 8: Get Pair Addresses ───────────────────────────────────
  console.log("8. Recording pair addresses...");
  const factoryContract = new ethers.Contract(
    factoryAddress,
    require("@uniswap/v2-core/build/UniswapV2Factory.json").abi,
    deployer
  );

  const ethUsdcPair = await factoryContract.getPair(wethAddress, await usdc.getAddress());
  const ethDaiPair = await factoryContract.getPair(wethAddress, await dai.getAddress());
  const ethLinkPair = await factoryContract.getPair(wethAddress, await link.getAddress());
  const usdcDaiPair = await factoryContract.getPair(await usdc.getAddress(), await dai.getAddress());

  console.log(`   ETH/USDC: ${ethUsdcPair}`);
  console.log(`   ETH/DAI:  ${ethDaiPair}`);
  console.log(`   ETH/LINK: ${ethLinkPair}`);
  console.log(`   USDC/DAI: ${usdcDaiPair}\n`);

  // ─── Step 9: Write Deployed Addresses ─────────────────────────────
  const addresses: DeployedAddresses = {
    network: network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      WETH: wethAddress,
      UniswapFactory: factoryAddress,
      UniswapRouter: routerAddress,
      SwapRouter: await swapRouter.getAddress(),
      SwapHelper: await swapHelper.getAddress(),
      LiquidityManager: await liquidityManager.getAddress(),
      tokens: {
        USDC: await usdc.getAddress(),
        DAI: await dai.getAddress(),
        LINK: await link.getAddress(),
        UNI: await uni.getAddress(),
        WBTC: await wbtc.getAddress(),
      },
      pairs: {
        "ETH/USDC": ethUsdcPair,
        "ETH/DAI": ethDaiPair,
        "ETH/LINK": ethLinkPair,
        "USDC/DAI": usdcDaiPair,
      },
    },
  };

  // Save deployed-addresses.json (used by backend tokenService)
  const outputPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(`✓ Addresses saved to: ${outputPath}`);

  // ─── Step 10: Auto-update root .env ────────────────────────────────
  console.log("\n9. Auto-updating root .env with contract addresses...");
  const rootEnvPath = path.join(__dirname, "../../.env");

  const envUpdates: Record<string, string> = {
    VITE_ROUTER: routerAddress,
    VITE_FACTORY: factoryAddress,
    VITE_WETH: wethAddress,
    VITE_SWAP_ROUTER: await swapRouter.getAddress(),
    VITE_SWAP_HELPER: await swapHelper.getAddress(),
    VITE_LIQUIDITY_MANAGER: await liquidityManager.getAddress(),
    ROUTER_ADDRESS: routerAddress,
    FACTORY_ADDRESS: factoryAddress,
  };

  updateEnvFile(rootEnvPath, envUpdates);

  console.log("\n─── Deployed Contract Addresses ───────────────────────");
  console.log(`  WETH:             ${wethAddress}`);
  console.log(`  Factory:          ${factoryAddress}`);
  console.log(`  Router02:         ${routerAddress}`);
  console.log(`  SwapRouter:       ${await swapRouter.getAddress()}`);
  console.log(`  SwapHelper:       ${await swapHelper.getAddress()}`);
  console.log(`  LiquidityManager: ${await liquidityManager.getAddress()}`);
  console.log("\n─── Mock Token Addresses ──────────────────────────────");
  console.log(`  USDC: ${await usdc.getAddress()}`);
  console.log(`  DAI:  ${await dai.getAddress()}`);
  console.log(`  LINK: ${await link.getAddress()}`);
  console.log(`  UNI:  ${await uni.getAddress()}`);
  console.log(`  WBTC: ${await wbtc.getAddress()}`);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅ Deployment Complete! .env updated automatically.");
  console.log("  Run 'npm run dev' from the root to start the project.");
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
