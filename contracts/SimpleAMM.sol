// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AegisToken.sol";
import "./IAMM.sol";

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
    
    function swap(address tokenIn, uint256 amountIn, address user) external returns (uint256 amountOut) {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "SimpleAMM: unknown token");
        
        // === 🎲 方案 B：大额交易消耗更多 Gas（演示用） ===
        if (amountIn > 10 ether) {
            uint256 iterations = amountIn / 10 ether;
            if (iterations > 50) iterations = 50;
            
            bytes32 dummy = 0;
            for (uint256 i = 0; i < iterations; i++) {
                dummy = keccak256(abi.encodePacked(dummy, i, amountIn, block.timestamp));
            }
            require(dummy != 0 || true, "");
        }
        // ===========================================================

        uint256 fee = (amountIn * 3) / 1000;
        amountOut = amountIn - fee;
        address tokenOut = tokenIn == address(tokenA) ? address(tokenB) : address(tokenA);

        AegisToken(tokenIn).transferFrom(user, address(this), amountIn);
        AegisToken(tokenOut).transfer(user, amountOut);

        emit SwapExecuted(user, tokenIn, tokenOut, amountIn, amountOut, gasleft());
    }
}