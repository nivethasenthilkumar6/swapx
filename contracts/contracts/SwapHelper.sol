// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./libraries/SwapMath.sol";

/// @title SwapHelper - Read-only helper for price queries, reserves, and arbitrage detection
/// @notice Pure view functions — no state changes. Used by frontend/backend for quotes and analytics.
contract SwapHelper {
    IUniswapV2Router02 public immutable router;
    IUniswapV2Factory public immutable factory;
    address public immutable WETH;

    uint256 private constant PRECISION = 1e18;
    uint256 private constant DEFAULT_FEE_BPS = 30; // 0.3% Uniswap V2 fee

    error PairNotFound();
    error ZeroAddress();

    constructor(address _router) {
        if (_router == address(0)) revert ZeroAddress();
        router = IUniswapV2Router02(_router);
        factory = IUniswapV2Factory(router.factory());
        WETH = router.WETH();
    }

    // ─── Price Queries ───────────────────────────────────────────────────

    /// @notice Get the spot price of tokenA in terms of tokenB
    /// @param tokenA Input token
    /// @param tokenB Output token
    /// @return price Spot price with 18 decimals precision
    function getSpotPrice(address tokenA, address tokenB)
        external
        view
        returns (uint256 price)
    {
        (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);
        price = SwapMath.getSpotPrice(reserveA, reserveB);
    }

    /// @notice Get a full swap quote including all fees and impacts
    /// @param amountIn Input amount
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param slippageBps Slippage tolerance in basis points
    /// @return amountOut Expected output amount
    /// @return minReceived Minimum received after slippage
    /// @return priceImpactBps Price impact in basis points
    /// @return lpFee LP fee amount
    /// @return executionPrice Execution price with 18 decimals
    function getFullQuote(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        uint256 slippageBps
    )
        external
        view
        returns (
            uint256 amountOut,
            uint256 minReceived,
            uint256 priceImpactBps,
            uint256 lpFee,
            uint256 executionPrice
        )
    {
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn, tokenOut);

        amountOut = SwapMath.getAmountOut(amountIn, reserveIn, reserveOut, DEFAULT_FEE_BPS);
        minReceived = SwapMath.getMinimumReceived(amountOut, slippageBps);
        priceImpactBps = SwapMath.getPriceImpact(amountIn, reserveIn, reserveOut, DEFAULT_FEE_BPS);
        lpFee = SwapMath.getLPFee(amountIn, DEFAULT_FEE_BPS);
        executionPrice = SwapMath.getExecutionPrice(amountIn, amountOut);
    }

    /// @notice Get amounts out for a multi-hop swap path
    /// @param amountIn Input amount
    /// @param path Swap path
    /// @return amounts Output amounts for each hop
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        return router.getAmountsOut(amountIn, path);
    }

    /// @notice Get amounts in for a multi-hop swap path (exact output)
    /// @param amountOut Desired output amount
    /// @param path Swap path
    /// @return amounts Required input amounts for each hop
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        return router.getAmountsIn(amountOut, path);
    }

    // ─── Pool / Pair Queries ─────────────────────────────────────────────

    /// @notice Check if a pair exists
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @return pair Pair address (address(0) if not found)
    /// @return exists Whether the pair exists
    function getPairInfo(address tokenA, address tokenB)
        external
        view
        returns (address pair, bool exists)
    {
        pair = factory.getPair(tokenA, tokenB);
        exists = pair != address(0);
    }

    /// @notice Get reserves for a token pair
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @return reserveA Reserve of token A
    /// @return reserveB Reserve of token B
    function getReserves(address tokenA, address tokenB)
        external
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        return _getReserves(tokenA, tokenB);
    }

    /// @notice Get pool statistics for a pair
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @return reserveA Reserve of token A
    /// @return reserveB Reserve of token B
    /// @return totalSupply Total LP token supply
    /// @return spotPrice Spot price (A in terms of B) with 18 decimals
    /// @return pairAddress The pair contract address
    function getPoolStats(address tokenA, address tokenB)
        external
        view
        returns (
            uint256 reserveA,
            uint256 reserveB,
            uint256 totalSupply,
            uint256 spotPrice,
            address pairAddress
        )
    {
        pairAddress = factory.getPair(tokenA, tokenB);
        if (pairAddress == address(0)) revert PairNotFound();

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        (uint112 r0, uint112 r1, ) = pair.getReserves();

        address token0 = pair.token0();
        if (tokenA == token0) {
            reserveA = uint256(r0);
            reserveB = uint256(r1);
        } else {
            reserveA = uint256(r1);
            reserveB = uint256(r0);
        }

        totalSupply = pair.totalSupply();
        spotPrice = SwapMath.getSpotPrice(reserveA, reserveB);
    }

    /// @notice Get total number of pairs created
    function totalPairs() external view returns (uint256) {
        return factory.allPairsLength();
    }

    /// @notice Get pair address by index
    function getPairByIndex(uint256 index) external view returns (address) {
        return factory.allPairs(index);
    }

    // ─── Arbitrage Detection ─────────────────────────────────────────────

    /// @notice Detect arbitrage opportunity between two pools for the same pair
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @param pool1Factory Factory address of pool 1
    /// @param pool2Factory Factory address of pool 2
    /// @return priceDiffBps Price difference in basis points
    /// @return isArbitrage Whether profitable arbitrage exists
    /// @return price1 Spot price in pool 1
    /// @return price2 Spot price in pool 2
    function detectArbitrage(
        address tokenA,
        address tokenB,
        address pool1Factory,
        address pool2Factory
    )
        external
        view
        returns (
            uint256 priceDiffBps,
            bool isArbitrage,
            uint256 price1,
            uint256 price2
        )
    {
        address pair1 = IUniswapV2Factory(pool1Factory).getPair(tokenA, tokenB);
        address pair2 = IUniswapV2Factory(pool2Factory).getPair(tokenA, tokenB);

        if (pair1 == address(0) || pair2 == address(0)) {
            return (0, false, 0, 0);
        }

        (uint256 r1A, uint256 r1B) = _getReservesFromPair(pair1, tokenA);
        (uint256 r2A, uint256 r2B) = _getReservesFromPair(pair2, tokenA);

        price1 = SwapMath.getSpotPrice(r1A, r1B);
        price2 = SwapMath.getSpotPrice(r2A, r2B);

        (priceDiffBps, isArbitrage) = SwapMath.detectArbitrage(r1A, r1B, r2A, r2B);
    }

    /// @notice Estimate arbitrage profit for a given trade size
    /// @param amountIn Input amount
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @return estimatedProfit Estimated profit in tokenA
    /// @return buyPool Which pool to buy from (1 or 2)
    function estimateArbitrageProfit(
        uint256 amountIn,
        address tokenA,
        address tokenB
    )
        external
        view
        returns (uint256 estimatedProfit, uint8 buyPool)
    {
        (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);

        // Simple single-pool arbitrage estimate
        uint256 amountOut = SwapMath.getAmountOut(amountIn, reserveA, reserveB, DEFAULT_FEE_BPS);
        uint256 amountBack = SwapMath.getAmountOut(amountOut, reserveB, reserveA, DEFAULT_FEE_BPS);

        if (amountBack > amountIn) {
            estimatedProfit = amountBack - amountIn;
            buyPool = 1;
        }
    }

    // ─── Internal Helpers ────────────────────────────────────────────────

    function _getReserves(address tokenA, address tokenB)
        internal
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        address pair = factory.getPair(tokenA, tokenB);
        if (pair == address(0)) revert PairNotFound();
        return _getReservesFromPair(pair, tokenA);
    }

    function _getReservesFromPair(address pair, address tokenA)
        internal
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        IUniswapV2Pair pairContract = IUniswapV2Pair(pair);
        (uint112 r0, uint112 r1, ) = pairContract.getReserves();
        address token0 = pairContract.token0();

        if (tokenA == token0) {
            reserveA = uint256(r0);
            reserveB = uint256(r1);
        } else {
            reserveA = uint256(r1);
            reserveB = uint256(r0);
        }
    }
}
