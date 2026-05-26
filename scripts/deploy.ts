import { ethers } from "hardhat";

async function main() {
  console.log("========================================");
  console.log("  Aegis Protocol — Contract Deployment");
  console.log("========================================\n");

  // 1. Deploy FakeERC20 TokenA
  const TokenFactory = await ethers.getContractFactory("AegisToken");
  const tokenA = await TokenFactory.deploy("Aegis Token A", "TKA", 1_000_000);
  await tokenA.waitForDeployment();
  const tokenAAddr = await tokenA.getAddress();
  console.log(`[TokenA]   AegisToken deployed at: ${tokenAAddr}`);

  // 2. Deploy AegisTokenB
  const tokenB = await TokenFactory.deploy("Aegis Token B", "TKB", 1_000_000);
  await tokenB.waitForDeployment();
  const tokenBAddr = await tokenB.getAddress();
  console.log(`[TokenB]   AegisToken deployed at: ${tokenBAddr}`);

  // 3. Deploy SimpleAMM
  const AMMFactory = await ethers.getContractFactory("SimpleAMM");
  const amm = await AMMFactory.deploy(tokenAAddr, tokenBAddr);
  await amm.waitForDeployment();
  const ammAddr = await amm.getAddress();
  console.log(`[MockAMM]  SimpleAMM deployed at:    ${ammAddr}`);

  // 4. Deploy AgentRegistry
  const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`[Registry] AgentRegistry deployed at: ${registryAddr}`);

  // 5. Deploy AgentExecutor
  const ExecutorFactory = await ethers.getContractFactory("AgentExecutor");
  const executor = await ExecutorFactory.deploy(ammAddr);
  await executor.waitForDeployment();
  const executorAddr = await executor.getAddress();
  console.log(`[Executor] AgentExecutor deployed at: ${executorAddr}`);

  // 6. Fund the SimpleAMM with tokens so it can serve as liquidity pool
  const [deployer] = await ethers.getSigners();
  const fundAmount = ethers.parseEther("100000"); // 100k tokens each
  await tokenA.transfer(ammAddr, fundAmount);
  await tokenB.transfer(ammAddr, fundAmount);
  console.log(`\n[Liquidity] Funded SimpleAMM with 100,000 TKA + 100,000 TKB`);

  console.log("\n========================================");
  console.log("  Deployment Complete!");
  console.log("========================================");
  console.log(`
  TokenA:        ${tokenAAddr}
  TokenB:        ${tokenBAddr}
  SimpleAMM:       ${ammAddr}
  AgentRegistry: ${registryAddr}
  AgentExecutor: ${executorAddr}
  Deployer:      ${deployer.address}
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
