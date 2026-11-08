export type RemoteStatus = 'succeeded' | 'failed' | 'pending' | 'unknown';

export type CheckoutInput = { paymentId: string; amount: number; currency: string; returnUrl: string; notifyUrl: string };
export type CheckoutResult = { providerRef: string; checkoutUrl: string; notifToken?: string };

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  fetchStatus(p: { id: string; providerRef: string | null; amount: number }): Promise<{ status: RemoteStatus; amount?: number; currency?: string }>;
}
