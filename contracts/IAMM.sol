// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAMM
 * @dev Unified interface for AMM adapters.
 *      AgentExecutor uses this — works with both SimpleAMM (mock) and RealAMM (UniswapV3).
 */
interface IAMM {
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256 amountOut);
}
