const { calculateEmi, generateSchedule, addMonths } = require('../lib/loan-calculator');
const input = { principalPaise: 20000000, annualInterestRate: 18, tenureMonths: 24, disbursementDate: '2026-10-05' };

test('EMI for Rs 2,00,000 @ 18% for 24 months is about Rs 9,986', () => {
  const emi = calculateEmi(20000000, 18, 24);
  expect(Math.abs(emi - 998600)).toBeLessThanOrEqual(200); // within Rs 2
});

test('schedule has one row per month with correct due dates', () => {
  const s = generateSchedule(input);
  expect(s).toHaveLength(24);
  expect(s[0].dueDate).toBe('2026-11-05');
  expect(s[23].dueDate).toBe('2028-10-05');
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
});

test('first instalment interest is exactly 1.5% of principal', () => {
  const s = generateSchedule(input);
  expect(s[0].interestAmount).toBe(300000); // Rs 3,000
  expect(s[0].totalDue).toBe(s[0].principalAmount + s[0].interestAmount);
});

test('final instalment absorbs rounding: principal parts sum to exactly the loan', () => {
  const s = generateSchedule(input);
  expect(s.reduce((sum, r) => sum + r.principalAmount, 0)).toBe(20000000);
  expect(Math.abs(s[23].totalDue - s[0].totalDue)).toBeLessThan(100); // within Rs 1 of the EMI
});
