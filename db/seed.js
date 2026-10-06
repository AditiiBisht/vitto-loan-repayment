// WARNING: wipes loans, schedules and payments, then re-creates 3 demo loans (ids 1,2,3).
const { pool } = require('../lib/db');
const { runSchema } = require('./migrate');
const { createLoan, recordPayment } = require('../lib/loan-service');

async function seed() {
  await runSchema();
  await pool.query('TRUNCATE payments, loan_schedule, loans RESTART IDENTITY CASCADE');
  // Loan 1 (A): fresh loan, nothing due yet
  await createLoan({ principalPaise: 20000000, annualInterestRate: 18, tenureMonths: 24, disbursementDate: '2026-10-05' });
  // Loan 2 (B): disbursed in March, no payments -> several overdue instalments
  await createLoan({ principalPaise: 50000000, annualInterestRate: 15, tenureMonths: 36, disbursementDate: '2026-03-05' });
  // Loan 3 (C): Rs 5,000 paid against a bigger EMI -> partial payment
  await createLoan({ principalPaise: 10000000, annualInterestRate: 12, tenureMonths: 12, disbursementDate: '2026-08-05' });
  await recordPayment(3, { amountPaise: 500000, date: '2026-09-05', idempotencyKey: 'seed-loan-3-p1' });
}
seed().then(() => console.log('Seeded')).catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
