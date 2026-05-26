/**
 * Quick setup: approve AMM to spend relayer's TokenA & TokenB.
 * Run: npx hardhat run scripts/approve-amm.ts --network localhost
 */
import { ethers } from "hardhat";

async function main() {
  const [relayer] = await ethers.getSigners();

  const TOKEN_A = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const TOKEN_B = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const AMM = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  const erc20Abi = ["function approve(address spender, uint256 amount) returns (bool)"];
  const tokenA = new ethers.Contract(TOKEN_A, erc20Abi, relayer);
  const tokenB = new ethers.Contract(TOKEN_B, erc20Abi, relayer);

  const huge = ethers.parseEther("1000000");

  console.log(`Approving AMM (${AMM}) to spend relayer's tokens…`);
  await tokenA.approve(AMM, huge);
  console.log("✅ TokenA approved");
  await tokenB.approve(AMM, huge);
  console.log("✅ TokenB approved");
  console.log("Done! Relayer can now submit batches.");
}

main().catch(console.error);
