import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://query1.finance.yahoo.com/v8/finance/chart/:ticker', ({ params }) => {
    const { ticker } = params;
    if (ticker === 'INVALID') {
      return new HttpResponse(null, { status: 404 });
    }
    if (ticker === 'RATELIMIT') {
      return new HttpResponse(null, { status: 429 });
    }
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.1) * 5);
    return HttpResponse.json({
      chart: { result: [{ indicators: { adjclose: [{ adjclose: closes }] } }] },
    });
  }),
];
