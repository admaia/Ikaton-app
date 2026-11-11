import { describe, expect, it } from 'vitest';
import { fcfa, initials, shortDate } from '@/lib/money';
import { addDays, clock, dayMonth, daysLeft, longDate, monthName, relativeDay, today } from '@/lib/dates';
import { commitmentMonths, needsSearch, pot } from '@/lib/tontine';

const thursday = new Date('2026-09-17T10:30:00Z');

describe('money', () => {
  it('groups thousands with a plain space', () => {
    expect(fcfa(25000)).toBe('25 000');
    expect(fcfa(1200000)).toBe('1 200 000');
    expect(fcfa(500)).toBe('500');
  });

  it('builds initials from the first two words', () => {
    expect(initials('Aïcha K.')).toBe('AK');
    expect(initials('aminata')).toBe('A');
    expect(initials('Mamadou Lamine Diarra')).toBe('ML');
  });

  it('formats a short French date without the trailing dot', () => {
    expect(shortDate(thursday)).toBe('17 sept');
  });
});

describe('dates', () => {
  it('formats in French and in English', () => {
    expect(dayMonth(thursday, 'fr')).toBe('17 sept.');
    expect(dayMonth(thursday, 'en')).toMatch(/^17 Sept?$/);
    expect(longDate(thursday, 'fr')).toBe('17 septembre');
    expect(longDate(thursday, 'en')).toBe('17 September');
    expect(monthName(thursday, 'fr')).toBe('Septembre');
    expect(monthName(thursday, 'en')).toBe('September');
  });

  it('capitalises the header date', () => {
    expect(today('fr', thursday)).toBe('Jeu. 17 sept.');
    expect(today('en', thursday)).toMatch(/^Thu 17 Sept?$/);
  });

  it('shows the time in Bamako, which is on UTC', () => {
    expect(clock(thursday)).toBe('10:30');
  });

  it('counts the days left and never goes below zero', () => {
    expect(daysLeft(addDays(thursday, 11), thursday)).toBe(11);
    expect(daysLeft(new Date(thursday.getTime() + 3600_000), thursday)).toBe(1);
    expect(daysLeft(addDays(thursday, -2), thursday)).toBe(0);
  });

  it('says today and yesterday, then falls back to the date', () => {
    expect(relativeDay(thursday, 'fr', thursday)).toBe('Aujourd’hui');
    expect(relativeDay(addDays(thursday, -1), 'en', thursday)).toBe('Yesterday');
    expect(relativeDay(addDays(thursday, -5), 'fr', thursday)).toBe('12 sept.');
  });
});

describe('circle maths', () => {
  it('the pot is every share of the cycle', () => {
    expect(pot(25000, 8)).toBe(200000);
  });

  it('search appears past 13 members', () => {
    expect(needsSearch(13)).toBe(false);
    expect(needsSearch(14)).toBe(true);
  });

  it('estimates the commitment in months, at least one', () => {
    expect(commitmentMonths(8, 'MONTH')).toBe(8);
    expect(commitmentMonths(12, 'WEEK')).toBe(3);
    expect(commitmentMonths(2, 'WEEK')).toBe(1);
  });
});
