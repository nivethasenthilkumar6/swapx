/**
 * Parse contract and Web3 transaction errors into human-readable messages.
 */

// OpenZeppelin v5 and Uniswap V2 custom error selectors
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  'e450d38c': 'Token allowance is insufficient. The approval transaction may not have confirmed yet — please wait and try again.',
  'fb8f41b2': 'Token allowance is insufficient. Please approve the contract to spend your tokens.',
  'f4d678b8': 'Insufficient token balance. You do not have enough tokens.',
  '82b42900': 'Transaction deadline has expired. Please try again.',
  '4a5541ef': 'Identical tokens. Cannot create a pair with the same token.',
  'ad3a8b9e': 'Pair not found. This pool does not exist yet.',
  '7a6db5a2': 'Contract is paused. Please try again later.',
};

export function parseTransactionError(error: any): string {
  if (!error) {
    return 'An unknown error occurred during transaction execution.';
  }

  // Log error for debugging
  console.debug('Parsing Web3 Error:', error);

  const message = error.message || '';
  const code = error.code || '';

  // 0. Decode known custom error selectors from revert data
  const dataString: string = error.data || error.error?.data || '';
  if (typeof dataString === 'string' && dataString.startsWith('0x')) {
    const selector = dataString.slice(2, 10).toLowerCase();
    if (KNOWN_ERROR_SELECTORS[selector]) {
      return KNOWN_ERROR_SELECTORS[selector];
    }
  }

  // 1. User Rejected Action
  if (
    code === 'ACTION_REJECTED' ||
    code === 4001 ||
    message.includes('rejected') ||
    message.includes('User denied') ||
    message.includes('User rejected')
  ) {
    return 'Transaction was rejected. Please approve the transaction in your wallet to proceed.';
  }

  // 2. Insufficient Funds
  if (
    code === 'INSUFFICIENT_FUNDS' ||
    message.includes('insufficient funds') ||
    (message.includes('balance') && !message.includes('allowance'))
  ) {
    return 'Insufficient ETH balance. You do not have enough Ether in your wallet to cover the transaction amount and network gas fees.';
  }

  // 3. Common DEX/Uniswap V2 Revert Reasons
  if (message.includes('INSUFFICIENT_OUTPUT_AMOUNT') || message.includes('amounts[1]')) {
    return 'Swap failed: Price slippage exceeded your tolerance limit. Try increasing slippage tolerance.';
  }

  if (message.includes('EXPIRED') || message.includes('deadline')) {
    return 'Transaction expired. The transaction was not processed within the deadline. Please try again.';
  }

  if (message.includes('TRANSFER_FROM_FAILED') || message.includes('allowance') || message.includes('InsufficientAllowance')) {
    return 'Token transfer failed. Please ensure you have approved the contract to spend your tokens and have sufficient balance.';
  }

  if (message.includes('INSUFFICIENT_A_AMOUNT') || message.includes('INSUFFICIENT_B_AMOUNT')) {
    return 'Add liquidity failed: Reserve ratio changed significantly. Please try again.';
  }

  if (message.includes('K')) {
    return 'DEX invariant failed. The constant product formula check failed.';
  }

  // 4. Fallback: Parse nested revert messages
  if (error.reason) {
    return `Transaction reverted: ${error.reason}`;
  }

  // Handle nested ethers/wagmi errors
  const nestedError = error.error || error.data;
  if (nestedError && nestedError.message) {
    return parseTransactionError(nestedError);
  }

  return 'Transaction failed. Check that you have enough tokens, gas fees, and are on Sepolia testnet.';
}
