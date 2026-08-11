/**
 * Web fallback: Stripe PaymentSheet is not available on web.
 */
export function useStripeSheet() {
  const notAvailable = async () => ({ error: { message: 'El pago con tarjeta está disponible en la app móvil' } });
  return { available: false, initPaymentSheet: notAvailable, presentPaymentSheet: notAvailable };
}
