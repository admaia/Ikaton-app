import type { Provider } from '@prisma/client';
import type { PaymentProvider } from './types';
import { wave } from './wave';
import { orange } from './orange';
import { sandbox } from './sandbox';

export function providerFor(p: Provider): PaymentProvider | null {
  if (p === 'WAVE') return wave;
  if (p === 'ORANGE') return orange;
  if (p === 'SANDBOX') return sandbox;
  return null; // CASH is validated by the circle admin; MOOV and CARD are not implemented
}
