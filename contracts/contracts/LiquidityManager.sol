// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IWETH.sol";

/// @title LiquidityManager - Manages liquidity operations on Uniswap V2
/// @notice Wraps the Uniswap V2 Router for add/remove liquidity with access control and events
contract LiquidityManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;
    address public immutable WETH;

    // ─── Custom Errors ───────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error PairNotFound();
    error DeadlineExpired();
    error InsufficientLiquidity();
    error TransferFailed();
    error IdenticalTokens();

    // ─── Events ──────────────────────────────────────────────────────────
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    event LiquidityETHAdded(
        address indexed provider,
        address indexed token,
        uint256 amountToken,
        uint256 amountETH,
        uint256 liquidity
    );
    event LiquidityETHRemoved(
        address indexed provider,
        address indexed token,
        uint256 amountToken,
        uint256 amountETH,
        uint256 liquidity
    );
    event PoolCreated(address indexed tokenA, address indexed tokenB, address pair);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier ensureDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _router) Ownable(msg.sender) {
        if (_router == address(0)) revert ZeroAddress();

        uniswapRouter = IUniswapV2Router02(_router);
        uniswapFactory = IUniswapV2Factory(uniswapRouter.factory());
        WETH = uniswapRouter.WETH();
    }

    // ─── Add Liquidity (Token/Token) ─────────────────────────────────────
    /// @notice Add liquidity to a token pair pool
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @param amountADesired Desired amount of token A
    /// @param amountBDesired Desired amount of token B
    /// @param amountAMin Minimum amount of token A
    /// @param amountBMin Minimum amount of token B
    /// @param to Recipient of LP tokens
    /// @param deadline Transaction deadline
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (tokenA == tokenB) revert IdenticalTokens();
        if (amountADesired == 0 || amountBDesired == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBDesired);

        IERC20(tokenA).forceApprove(address(uniswapRouter), amountADesired);
        IERC20(tokenB).forceApprove(address(uniswapRouter), amountBDesired);

        (amountA, amountB, liquidity) = uniswapRouter.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            to,
            deadline
        );

        // Refund unused tokens
        uint256 refundA = amountADesired - amountA;
        uint256 refundB = amountBDesired - amountB;
        if (refundA > 0) IERC20(tokenA).safeTransfer(msg.sender, refundA);
        if (refundB > 0) IERC20(tokenB).safeTransfer(msg.sender, refundB);

        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    // ─── Add Liquidity ETH ───────────────────────────────────────────────
    /// @notice Add liquidity to a token/ETH pool
    /// @param token Token address
    /// @param amountTokenDesired Desired amount of token
    /// @param amountTokenMin Minimum amount of token
    /// @param amountETHMin Minimum amount of ETH
    /// @param to Recipient of LP tokens
    /// @param deadline Transaction deadline
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)
    {
        if (token == address(0)) revert ZeroAddress();
        if (amountTokenDesired == 0 || msg.value == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amountTokenDesired);
        IERC20(token).forceApprove(address(uniswapRouter), amountTokenDesired);

        (amountToken, amountETH, liquidity) = uniswapRouter.addLiquidityETH{value: msg.value}(
            token,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        // Refund unused tokens and ETH
        uint256 refundToken = amountTokenDesired - amountToken;
        if (refundToken > 0) IERC20(token).safeTransfer(msg.sender, refundToken);

        uint256 refundETH = msg.value - amountETH;
        if (refundETH > 0) {
            (bool success, ) = msg.sender.call{value: refundETH}("");
            if (!success) revert TransferFailed();
        }

        emit LiquidityETHAdded(msg.sender, token, amountToken, amountETH, liquidity);
    }

    // ─── Remove Liquidity (Token/Token) ──────────────────────────────────
    /// @notice Remove liquidity from a token pair pool
    /// @param tokenA Token A address
    /// @param tokenB Token B address
    /// @param liquidity Amount of LP tokens to burn
    /// @param amountAMin Minimum amount of token A to receive
    /// @param amountBMin Minimum amount of token B to receive
    /// @param to Recipient of tokens
    /// @param deadline Transaction deadline
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        if (liquidity == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        address pair = uniswapFactory.getPair(tokenA, tokenB);
        if (pair == address(0)) revert PairNotFound();

        IERC20(pair).safeTransferFrom(msg.sender, address(this), liquidity);
        IERC20(pair).forceApprove(address(uniswapRouter), liquidity);

        (amountA, amountB) = uniswapRouter.removeLiquidity(
            tokenA,
            tokenB,
            liquidity,
            amountAMin,
            amountBMin,
            to,
            deadline
        );

        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    // ─── Remove Liquidity ETH ────────────────────────────────────────────
    /// @notice Remove liquidity from a token/ETH pool
    /// @param token Token address
    /// @param liquidity Amount of LP tokens to burn
    /// @param amountTokenMin Minimum amount of token to receive
    /// @param amountETHMin Minimum amount of ETH to receive
    /// @param to Recipient of tokens and ETH
    /// @param deadline Transaction deadline
    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        ensureDeadline(deadline)
        returns (uint256 amountToken, uint256 amountETH)
    {
        if (liquidity == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        address pair = uniswapFactory.getPair(token, WETH);
        if (pair == address(0)) revert PairNotFound();

        IERC20(pair).safeTransferFrom(msg.sender, address(this), liquidity);
        IERC20(pair).forceApprove(address(uniswapRouter), liquidity);

        (amountToken, amountETH) = uniswapRouter.removeLiquidityETH(
            token,
            liquidity,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );

        emit LiquidityETHRemoved(msg.sender, token, amountToken, amountETH, liquidity);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Check if a pair exists for two tokens
    function checkPair(address tokenA, address tokenB)
        external
        view
        returns (address pair, bool exists)
    {
        pair = uniswapFactory.getPair(tokenA, tokenB);
        exists = pair != address(0);
    }

    /// @notice Get the reserves for a token pair
    function getReserves(address tokenA, address tokenB)
        external
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        address pair = uniswapFactory.getPair(tokenA, tokenB);
        if (pair == address(0)) revert PairNotFound();

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

    /// @notice Get LP token balance of a user for a pair
    function getLPBalance(address tokenA, address tokenB, address user)
        external
        view
        returns (uint256 balance, uint256 totalSupply, address pair)
    {
        pair = uniswapFactory.getPair(tokenA, tokenB);
        if (pair == address(0)) revert PairNotFound();

        balance = IERC20(pair).balanceOf(user);
        totalSupply = IUniswapV2Pair(pair).totalSupply();
    }

    /// @notice Create a new pair (convenience wrapper)
    function createPair(address tokenA, address tokenB)
        external
        returns (address pair)
    {
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (tokenA == tokenB) revert IdenticalTokens();

        pair = uniswapFactory.createPair(tokenA, tokenB);
        emit PoolCreated(tokenA, tokenB, pair);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdraw stuck tokens or ETH
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();

        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, amount, to);
    }

    // ─── Receive ─────────────────────────────────────────────────────────
    receive() external payable {}
}
