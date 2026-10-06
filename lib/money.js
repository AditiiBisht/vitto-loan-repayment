// Convert rupees (number or string, max 2 decimals) to integer paise WITHOUT float maths.
// "9986.5" -> 998650. Returns null if the value is not a valid non-negative amount.
function rupeesToPaise(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [rupees, fraction = ''] = text.split('.');
  return Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
}
module.exports = { rupeesToPaise };
