// Database + business flow. Routes call these; they contain no HTTP code.
const { pool, withTransaction } = require('./db');
const { AppError } = require('./errors');
const { generateSchedule } = require('./loan-calculator');
const { allocatePayment, computePosition } = require('./payment-allocation');

const today = () => new Date().toISOString().slice(0, 10);

const toLoan = (r) => ({
  id: r.id, principalPaise: r.principal, annualInterestRate: r.annual_interest_rate,
  tenureMonths: r.tenure_months, disbursementDate: r.disbursement_date, createdAt: r.created_at,
});

// db = pool or a transaction client
async function getLoanDetail(id, db = pool, asOf = today()) {
  const loanRes = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
  if (!loanRes.rowCount) return null;
  const rows = (await db.query('SELECT * FROM loan_schedule WHERE loan_id = $1 ORDER BY installment_number', [id])).rows;
  const schedule = rows.map((r) => {
    const outstanding = r.total_due - r.amount_paid;
    return {
      installmentNumber: r.installment_number, dueDate: r.due_date,
      principalAmountPaise: r.principal_amount, interestAmountPaise: r.interest_amount,
      totalDuePaise: r.total_due, amountPaidPaise: r.amount_paid, outstandingPaise: outstanding,
      status: outstanding === 0 ? 'PAID' : r.amount_paid > 0 ? 'PARTIAL' : 'PENDING',
      overdue: outstanding > 0 && r.due_date < asOf,
    };
  });
  return { loan: toLoan(loanRes.rows[0]), schedule, position: computePosition(rows, asOf) };
}

async function listLoans() {
  const res = await pool.query('SELECT * FROM loans ORDER BY id');
  return res.rows.map(toLoan);
}

async function createLoan(input) {
  return withTransaction(async (client) => {
    const res = await client.query(
      'INSERT INTO loans (principal, annual_interest_rate, tenure_months, disbursement_date) VALUES ($1,$2,$3,$4) RETURNING id',
      [input.principalPaise, input.annualInterestRate, input.tenureMonths, input.disbursementDate]);
    const loanId = res.rows[0].id;
    for (const s of generateSchedule(input)) {
      await client.query(
        'INSERT INTO loan_schedule (loan_id, installment_number, due_date, principal_amount, interest_amount, total_due) VALUES ($1,$2,$3,$4,$5,$6)',
        [loanId, s.installmentNumber, s.dueDate, s.principalAmount, s.interestAmount, s.totalDue]);
    }
    return getLoanDetail(loanId, client);
  });
}

async function recordPayment(loanId, { amountPaise, date, idempotencyKey }) {
  return withTransaction(async (client) => {
    // Lock the loan row: two simultaneous payments for one loan run one after the other.
    const lock = await client.query('SELECT id FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
    if (!lock.rowCount) throw new AppError(404, 'NOT_FOUND', 'Loan not found');

    // The UNIQUE (loan_id, idempotency_key) constraint decides whether this is a repeat.
    const ins = await client.query(
      `INSERT INTO payments (loan_id, amount, payment_date, idempotency_key) VALUES ($1,$2,$3,$4)
       ON CONFLICT (loan_id, idempotency_key) DO NOTHING RETURNING *`,
      [loanId, amountPaise, date, idempotencyKey]);
    const duplicate = ins.rowCount === 0;
    const payRow = duplicate
      ? (await client.query('SELECT * FROM payments WHERE loan_id = $1 AND idempotency_key = $2', [loanId, idempotencyKey])).rows[0]
      : ins.rows[0];

    let allocations = [];
    if (!duplicate) {
      const rows = (await client.query('SELECT * FROM loan_schedule WHERE loan_id = $1 ORDER BY installment_number', [loanId])).rows;
      const result = allocatePayment(rows, amountPaise);
      if (result.excessPaise > 0) {
        // Throwing rolls back the payment insert too, so nothing is saved or lost.
        throw new AppError(422, 'PAYMENT_EXCEEDS_OUTSTANDING',
          `Payment exceeds total outstanding by ${result.excessPaise} paise; nothing was applied`);
      }
      allocations = result.allocations;
      for (const a of allocations) {
        await client.query('UPDATE loan_schedule SET amount_paid = amount_paid + $1 WHERE loan_id = $2 AND installment_number = $3',
          [a.appliedPaise, loanId, a.installmentNumber]);
      }
    }
    const detail = await getLoanDetail(loanId, client);
    return {
      duplicate,
      payment: { id: payRow.id, amountPaise: payRow.amount, paymentDate: payRow.payment_date, idempotencyKey: payRow.idempotency_key },
      allocations, ...detail,
    };
  });
}
module.exports = { createLoan, getLoanDetail, listLoans, recordPayment };
