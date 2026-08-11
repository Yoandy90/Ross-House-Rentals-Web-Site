/**
 * Stripe PaymentSheet hook (native). Web fallback in useStripeSheet.web.ts
 */
import { useStripe } from '@stripe/stripe-react-native';

export function useStripeSheet() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  return { available: true, initPaymentSheet, presentPaymentSheet };
}
