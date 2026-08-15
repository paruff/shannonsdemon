import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { fetchQuote } from '../finance';
import { setupServer } from 'msw/node';
import { handlers } from '../../mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('fetchQuote', () => {
  it('returns price + volatility data for valid ticker', async () => {
    const result = await fetchQuote('SPY', '1y');
    expect(result.ticker).toBe('SPY');
    expect(result.latestPrice).toBeGreaterThan(0);
    expect(result.closes.length).toBeGreaterThan(10);
  });
  it('throws on 404', async () => {
    await expect(fetchQuote('INVALID', '1y')).rejects.toThrow('404');
  });
  it('throws on 429 rate limit', async () => {
    await expect(fetchQuote('RATELIMIT', '1y')).rejects.toThrow('429');
  });
});
