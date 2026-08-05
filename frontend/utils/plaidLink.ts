/**
 * Plaid Link SDK stub for web platform
 * The actual SDK only works on iOS/Android native builds
 */

export type LinkSuccess = { publicToken: string; metadata?: any };
export type LinkExit = { error?: any };

export const plaidCreate = async (_config: any) => {
  console.log('Plaid SDK not available on web');
};

export const plaidOpen = (_config: any) => {
  console.log('Plaid Link is only available on iOS/Android devices');
};

export const plaidDismiss = () => {};

export const PlaidIOSPresentation = { MODAL: 'MODAL' as const };
export const PlaidLogLevel = { ERROR: 'ERROR' as const };
export const isPlaidAvailable = false;
