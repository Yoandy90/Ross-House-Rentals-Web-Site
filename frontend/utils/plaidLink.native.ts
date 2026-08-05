/**
 * Plaid Link SDK wrapper for native platforms (iOS/Android)
 */
import {
  create,
  open,
  dismissLink,
  LinkSuccess,
  LinkExit,
  LinkIOSPresentationStyle,
  LinkLogLevel,
} from 'react-native-plaid-link-sdk';

export const plaidCreate = create;
export const plaidOpen = open;
export const plaidDismiss = dismissLink;
export const PlaidIOSPresentation = LinkIOSPresentationStyle;
export const PlaidLogLevel = LinkLogLevel;
export const isPlaidAvailable = true;

export type { LinkSuccess, LinkExit };
