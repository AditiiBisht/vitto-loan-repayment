// Real PostgreSQL (TEST_DATABASE_URL). Only the Firebase token check is replaced.
jest.setTimeout(30000);
jest.mock('../lib/firebase-admin', () => ({
  verifyToken: async (t) => { if (t === 'valid') return { uid: 'u1' }; throw new Error('bad token'); },
}));
const { pool } = require('../lib/db');
const { runSchema } = require('../db/migrate');
const loansRoute = require('../app/api/loans/route');
const payRoute = require('../app/api/loans/[id]/payments/route');

const req = (url, body, token = 'valid') => new Request('http://localhost' + url, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
});
const ctx = (id) => ({ params: Promise.resolve({ id: String(id) }) });
const newLoan = { principal: 200000, annualInterestRate: 18, tenureMonths: 24, disbursementDate: '2026-10-05' };

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to run integration tests');
  await runSchema();
});
afterAll(() => pool.end());

test('request without a token gets 401', async () => {
  const res = await loansRoute.POST(req('/api/loans', newLoan, null));
  expect(res.status).toBe(401);
  expect((await res.json()).success).toBe(false);
});

test('creates a loan, persists 24 instalments, applies a payment once even if repeated', async () => {
  const created = await loansRoute.POST(req('/api/loans', newLoan));
  expect(created.status).toBe(201);
  const loanId = (await created.json()).data.loan.id;
  expect((await pool.query('SELECT count(*)::int AS n FROM loan_schedule WHERE loan_id=$1', [loanId])).rows[0].n).toBe(24);

  const body = { amount: 5000, date: '2026-11-05', idempotencyKey: 'dup-1' };
  const first = await payRoute.POST(req(`/api/loans/${loanId}/payments`, body), ctx(loanId));
  const second = await payRoute.POST(req(`/api/loans/${loanId}/payments`, body), ctx(loanId));
  expect(first.status).toBe(201);
  expect(second.status).toBe(200);
  expect((await second.json()).data.duplicate).toBe(true);
  expect((await pool.query('SELECT count(*)::int AS n FROM payments WHERE loan_id=$1', [loanId])).rows[0].n).toBe(1);
  const paid = await pool.query('SELECT amount_paid FROM loan_schedule WHERE loan_id=$1 AND installment_number=1', [loanId]);
  expect(paid.rows[0].amount_paid).toBe(500000); // Rs 5,000 applied once, not twice
});

test('invalid input and unknown loan are rejected', async () => {
  expect((await loansRoute.POST(req('/api/loans', { ...newLoan, principal: -5 }))).status).toBe(400);
  expect((await loansRoute.POST(req('/api/loans', { ...newLoan, tenureMonths: 0 }))).status).toBe(400);
  const bad = await payRoute.POST(req('/api/loans/1/payments', { amount: 0, date: '2026-11-05', idempotencyKey: 'x' }), ctx(1));
  expect(bad.status).toBe(400);
  const unknown = await payRoute.POST(req('/api/loans/999999999/payments', { amount: 100, date: '2026-11-05', idempotencyKey: 'x' }), ctx(999999999));
  expect(unknown.status).toBe(404);
});
