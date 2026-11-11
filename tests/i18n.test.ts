import { describe, expect, it } from 'vitest';
import { ledgerText } from '@/i18n/dict';

describe('ledgerText', () => {
  it('translates the line written by settle()', () => {
    expect(ledgerText('Fatou S. a déposé sa part', 'en')).toBe('Fatou S. paid their share');
  });

  it('translates meta lines and keeps names intact', () => {
    expect(ledgerText('Espèces · validées par Aïcha K.', 'en')).toBe('Cash · confirmed by Aïcha K.');
    expect(ledgerText('Wave · vérifié auprès de l’opérateur', 'en')).toBe('Wave · verified with the operator');
    expect(ledgerText('Carte · vérifié auprès de l’opérateur', 'en')).toBe('Card · verified with the operator');
    expect(ledgerText('Espèces · 120 000', 'en')).toBe('Cash · 120 000');
  });

  it('leaves French untouched and unknown lines as written', () => {
    expect(ledgerText('Fatou S. a déposé sa part', 'fr')).toBe('Fatou S. a déposé sa part');
    expect(ledgerText('Ligne libre du gestionnaire', 'en')).toBe('Ligne libre du gestionnaire');
    expect(ledgerText(null, 'en')).toBeNull();
  });
});
