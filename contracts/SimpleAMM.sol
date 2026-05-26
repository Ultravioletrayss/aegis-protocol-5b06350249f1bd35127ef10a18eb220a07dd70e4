// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AegisToken.sol";
import "./IAMM.sol";

/**
 * @title SimpleAMM
 * @dev Mock AMM for local Hardhat testing — uses 1:1 exchange with 0.3% fee.
 *      Implements IAMM for compatibility with AgentExecutor.
 */
contract SimpleAMM is IAMM {
    AegisToken public tokenA;
    AegisToken public tokenB;

    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasUsed
    );

    constructor(address _tokenA, address _tokenB) {
        tokenA = AegisToken(_tokenA);
        tokenB = AegisToken(_tokenB);
    }

    /**
     * @dev Simple 1:1 swap between tokenA ↔ tokenB.
     *      A real AMM would use x*y=k; we fake it for the MVP.
     * @param user The original intent owner (caller in direct mode, end-user in batch mode)
     */
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "SimpleAMM: unknown token");
        // 1:1 exchange rate, mock 0.3% fee
        uint256 fee = (amountIn * 3) / 1000;
        amountOut = amountIn - fee;

        address tokenOut = tokenIn == address(tokenA) ? address(tokenB) : address(tokenA);

        AegisToken(tokenIn).transferFrom(user, address(this), amountIn);
        AegisToken(tokenOut).transfer(user, amountOut);

        uint256 gasUsed = gasleft();

        emit SwapExecuted(user, tokenIn, tokenOut, amountIn, amountOut, gasUsed);
    }
}
