const { allocatePayment, computePosition } = require('../lib/payment-allocation');
// Two instalments of Rs 100 (interest 30 + principal 70), amounts in paise
const mk = (n, due, paid = 0) => ({ installment_number: n, due_date: due, interest_amount: 3000, principal_amount: 7000, total_due: 10000, amount_paid: paid });
const rows = () => [mk(1, '2026-11-05'), mk(2, '2026-12-05')];

test('underpayment leaves the instalment partly unpaid (interest paid first)', () => {
  const { allocations, excessPaise } = allocatePayment(rows(), 5000);
  expect(allocations).toEqual([{ installmentNumber: 1, appliedPaise: 5000, interestPaise: 3000, principalPaise: 2000 }]);
  expect(excessPaise).toBe(0);
  const r = rows(); r[0].amount_paid = 5000;
  expect(computePosition(r, '2026-11-01').nextDueAmountPaise).toBe(5000);
});

test('overpayment settles the current instalment and continues into the next', () => {
  const { allocations } = allocatePayment(rows(), 15000);
  expect(allocations.map((a) => [a.installmentNumber, a.appliedPaise])).toEqual([[1, 10000], [2, 5000]]);
});

test('late payment is allocated normally, no penalty; overdue depends on paid status', () => {
  expect(allocatePayment(rows(), 10000).allocations[0].appliedPaise).toBe(10000); // exact, no extra charge
  const paid = [mk(1, '2026-11-05', 10000), mk(2, '2026-12-05')];
  expect(computePosition(paid, '2026-11-16').overdueAmountPaise).toBe(0);
  const partial = [mk(1, '2026-11-05', 4000), mk(2, '2026-12-05')];
  expect(computePosition(partial, '2026-11-16').overdueAmountPaise).toBe(6000);
});

test('payment larger than everything outstanding reports the excess', () => {
  expect(allocatePayment(rows(), 25000).excessPaise).toBe(5000);
});
