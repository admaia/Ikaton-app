import type { PaymentStatus } from '@prisma/client';

const NEXT: Record<PaymentStatus, PaymentStatus[]> = {
  INITIATED: ['PENDING', 'FAILED', 'EXPIRED'],
  PENDING: ['CONFIRMED', 'FAILED', 'EXPIRED', 'NEEDS_REVIEW'],
  // The provider may confirm after our timeout; the share is still counted if it is free.
  EXPIRED: ['CONFIRMED', 'NEEDS_REVIEW'],
  FAILED: ['NEEDS_REVIEW'],
  NEEDS_REVIEW: ['CONFIRMED', 'FAILED'],
  CONFIRMED: [],
};

export const canTransition = (from: PaymentStatus, to: PaymentStatus) => NEXT[from].includes(to);
export const isLive = (s: PaymentStatus) => s === 'INITIATED' || s === 'PENDING';

export type PublicPayment = {
  id: string;
  status: PaymentStatus;
  provider: string;
  amount: number;
  expiresAt: string;
  confirmedAt: string | null;
  failureReason: string | null;
  checkoutUrl: string | null;
};
