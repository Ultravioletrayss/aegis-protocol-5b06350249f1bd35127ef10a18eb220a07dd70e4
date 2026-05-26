/**
 * Deploy for Hardhat Mainnet Forking mode.
 * Uses RealAMM (Uniswap V3) instead of SimpleAMM (mock).
 *
 * Prerequisites:
 *   1. MAINNET_RPC_URL in root .env (Alchemy/Infura)
 *   2. npx hardhat node --network hardhat-fork
 *   3. Run: npx hardhat run scripts/deploy-fork.ts --network hardhat-fork
 */
import { ethers } from "hardhat";

async function main() {
  console.log("========================================");
  console.log("  Aegis Protocol — Forking Deployment");
  console.log("  (RealAMM — Uniswap V3 Integration)");
  console.log("========================================\n");

  // 1. Deploy AgentRegistry
  const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`[Registry] AgentRegistry: ${registryAddr}`);

  // 2. Deploy RealAMM (Uniswap V3 adapter)
  const RealAMMFactory = await ethers.getContractFactory("RealAMM");
  const amm = await RealAMMFactory.deploy();
  await amm.waitForDeployment();
  const ammAddr = await amm.getAddress();
  console.log(`[RealAMM]  RealAMM deployed at:  ${ammAddr}`);

  // Read current pool price
  try {
    const price = await amm.getPrice();
    console.log(`[Price]    sqrtPriceX96=${price.sqrtPriceX96} tick=${price.tick}`);
  } catch (e: any) {
    console.log(`[Price]    Could not fetch pool price: ${e.message}`);
  }

  // 3. Deploy AgentExecutor (uses IAMM interface — works with RealAMM)
  const ExecutorFactory = await ethers.getContractFactory("AgentExecutor");
  const executor = await ExecutorFactory.deploy(ammAddr);
  await executor.waitForDeployment();
  const executorAddr = await executor.getAddress();
  console.log(`[Executor] AgentExecutor:     ${executorAddr}`);

  // 4. Fund relayer with simulated WETH for swaps
  const [deployer] = await ethers.getSigners();
  console.log(`\n[Funding] Funding deployer with simulated WETH balance…`);
  // hardhat_setBalance can inject WETH on forked node:
  // await ethers.provider.send("hardhat_setBalance", [WETH_ADDR, "0x..."]);
  console.log(`[Funding] Deployer: ${deployer.address}`);
  console.log(`[Funding] ⚠️  You may need to hardhat_impersonateAccount to get WETH.`);

  console.log("\n========================================");
  console.log("  Forking Deployment Complete!");
  console.log("========================================");
  console.log(`
  AgentRegistry: ${registryAddr}
  RealAMM:       ${ammAddr}
  AgentExecutor: ${executorAddr}
  Deployer:      ${deployer.address}
  `);
  console.log("Next steps:");
  console.log("  1. Update relayer/.env AGENT_EXECUTOR_ADDRESS");
  console.log("  2. Start relayer: npm run relayer");
  console.log("  3. Send swapt intents — they route through REAL UniswapV3!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
