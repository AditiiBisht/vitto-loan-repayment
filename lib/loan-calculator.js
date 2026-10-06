// EMI + amortisation schedule. All money is integer paise.

// EMI = P*r*(1+r)^n / ((1+r)^n - 1). The formula needs a decimal power, so floating point is
// used only INSIDE this function and the result is rounded to whole paise once, immediately.
function calculateEmi(principalPaise, annualRatePercent, months) {
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return Math.round(principalPaise / months);
  const growth = Math.pow(1 + r, months);
  return Math.round((principalPaise * r * growth) / (growth - 1));
}

// Add n months to 'YYYY-MM-DD'; clamps to month end (31 Jan + 1 month = 28/29 Feb).
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = m - 1 + n;
  const year = y + Math.floor(total / 12);
  const month = total % 12; // 0-based
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Rounding strategy:
//  - interest each month = round(balance * rate / 1200) to whole paise
//  - principal part = EMI - interest
//  - LAST instalment: principal part = whatever balance is left, so balance ends at exactly 0
function generateSchedule({ principalPaise, annualInterestRate, tenureMonths, disbursementDate }) {
  const emi = calculateEmi(principalPaise, annualInterestRate, tenureMonths);
  const rows = [];
  let balance = principalPaise;
  for (let i = 1; i <= tenureMonths; i++) {
    const interest = Math.round((balance * annualInterestRate) / 1200);
    let principal = i === tenureMonths ? balance : emi - interest;
    if (principal > balance) principal = balance;
    rows.push({
      installmentNumber: i,
      dueDate: addMonths(disbursementDate, i),
      principalAmount: principal,
      interestAmount: interest,
      totalDue: principal + interest,
      amountPaid: 0,
    });
    balance -= principal;
  }
  return rows;
}
module.exports = { calculateEmi, addMonths, generateSchedule };
