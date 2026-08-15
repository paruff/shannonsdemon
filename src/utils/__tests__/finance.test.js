import { describe, it, expect } from 'vitest';
import { annualizedVol, inverseVolWeights, taxLocationWaterfall, generateTrades } from '../finance';

describe('annualizedVol', () => {
  it('returns ~0.16 for 1% daily alternating returns', () => {
    const closes = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
    const vol = annualizedVol(closes);
    expect(vol).toBeGreaterThan(0.1);
    expect(vol).toBeLessThan(0.3);
  });
  it('returns 0 for flat prices', () => {
    expect(annualizedVol([100, 100, 100, 100])).toBe(0);
  });
});

describe('inverseVolWeights', () => {
  it('weights inversely to volatility', () => {
    const weights = inverseVolWeights({ A: 0.1, B: 0.2 });
    expect(weights.A).toBeCloseTo(0.667, 2);
    expect(weights.B).toBeCloseTo(0.333, 2);
  });
});

describe('taxLocationWaterfall', () => {
  it('places high-inefficiency assets in best accounts first', () => {
    const targetWeights = { TLT: 0.4, SPY: 0.6 };
    const prices = { TLT: 100, SPY: 400 };
    const accounts = { 'Roth IRA': 50000, Taxable: 50000 };
    const result = taxLocationWaterfall(targetWeights, prices, accounts, 100000);
    expect(result['Roth IRA'].TLT).toBeGreaterThan(0);
  });
});

describe('generateTrades', () => {
  it('generates BUY when underweight', () => {
    const current = { Taxable: { SPY: 0 } };
    const target = { Taxable: { SPY: 50000 } };
    const prices = { SPY: 500 };
    const trades = generateTrades(current, target, prices, 100000, 0.05);
    expect(trades[0].action).toBe('BUY');
  });
  it('generates no trades when within threshold', () => {
    const current = { Taxable: { SPY: 100 } };
    const target = { Taxable: { SPY: 50000 } };
    const prices = { SPY: 500 };
    const trades = generateTrades(current, target, prices, 100000, 0.05);
    expect(trades.length).toBe(0);
  });
});
