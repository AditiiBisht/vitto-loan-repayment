// Pure functions (no DB). Rows use DB column names (snake_case), money in paise.
// Interest is paid before principal inside an instalment, so interest paid / principal paid
// can be derived from amount_paid alone: interestPaid = min(amount_paid, interest_amount).

const byNumber = (rows) => [...rows].sort((a, b) => a.installment_number - b.installment_number);

// Oldest outstanding instalment first; interest first, then principal; spill into the next one.
function allocatePayment(rows, amountPaise) {
  const allocations = [];
  let remaining = amountPaise;
  for (const row of byNumber(rows)) {
    if (remaining === 0) break;
    const outstanding = row.total_due - row.amount_paid;
    if (outstanding <= 0) continue;
    const applied = Math.min(remaining, outstanding); // never more than what is owed
    const interestOutstanding = Math.max(0, row.interest_amount - row.amount_paid);
    const toInterest = Math.min(applied, interestOutstanding);
    allocations.push({
      installmentNumber: row.installment_number,
      appliedPaise: applied,
      interestPaise: toInterest,
      principalPaise: applied - toInterest,
    });
    remaining -= applied;
  }
  return { allocations, excessPaise: remaining }; // excess > 0 => caller must reject
}

// asOfDate 'YYYY-MM-DD': an instalment is overdue if due_date < asOfDate and not fully paid.
function computePosition(rows, asOfDate) {
  let outstandingPrincipal = 0;
  let overdue = 0;
  let next = null;
  for (const row of byNumber(rows)) {
    const interestPaid = Math.min(row.amount_paid, row.interest_amount);
    outstandingPrincipal += row.principal_amount - (row.amount_paid - interestPaid);
    const outstanding = row.total_due - row.amount_paid;
    if (outstanding > 0) {
      if (!next) next = { dueDate: row.due_date, amount: outstanding };
      if (row.due_date < asOfDate) overdue += outstanding;
    }
  }
  return {
    outstandingPrincipalPaise: outstandingPrincipal,
    nextDueDate: next ? next.dueDate : null,
    nextDueAmountPaise: next ? next.amount : 0,
    overdueAmountPaise: overdue,
  };
}
module.exports = { allocatePayment, computePosition };
