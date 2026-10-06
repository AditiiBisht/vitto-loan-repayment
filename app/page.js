'use client';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase-client';

// 998650 -> "₹9,986.50" (integer maths only)
const rupees = (p) => '₹' + Math.floor(p / 100).toLocaleString('en-IN') + '.' + String(p % 100).padStart(2, '0');

// Calls our API with the Firebase ID token; throws Error(message) on failure
async function api(path, options = {}) {
  const token = await getFirebaseAuth().currentUser.getIdToken();
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loans, setLoans] = useState([]);
  const [detail, setDetail] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState('');
  const keyRef = useRef(null); // reused if the same submit is retried

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), (u) => { setUser(u); setReady(true); }), []);
  useEffect(() => {
    if (!user) return;
    setDate(new Date().toISOString().slice(0, 10));
    api('/api/loans').then(setLoans).catch((e) => setMsg(e.message));
  }, [user]);

  const signIn = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(getFirebaseAuth(), email, password).catch((err) => setMsg(err.message));
  };
  const openLoan = (id) => {
    setMsg(''); setDetail(null);
    if (id) api(`/api/loans/${id}`).then(setDetail).catch((e) => setMsg(e.message));
  };
  const pay = async (e) => {
    e.preventDefault();
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    try {
      const result = await api(`/api/loans/${detail.loan.id}/payments`, {
        method: 'POST', body: JSON.stringify({ amount, date, idempotencyKey: keyRef.current }),
      });
      setDetail({ loan: result.loan, schedule: result.schedule, position: result.position }); // no page refresh needed
      setMsg(result.duplicate ? 'Payment was already recorded earlier.' : 'Payment recorded.');
      setAmount(''); keyRef.current = null;
    } catch (err) { setMsg('Error: ' + err.message); }
  };

  if (!ready) return <p>Loading...</p>;
  if (!user) {
    return (
      <form onSubmit={signIn}>
        <h1>Sign in</h1>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />{' '}
        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />{' '}
        <button type="submit">Sign in</button>
        <p>{msg}</p>
      </form>
    );
  }
  const pos = detail && detail.position;
  return (
    <div>
      <h1>Loans</h1>
      <p>{user.email} <button onClick={() => signOut(getFirebaseAuth())}>Sign out</button></p>
      <select defaultValue="" onChange={(e) => openLoan(e.target.value)}>
        <option value="">Select a loan</option>
        {loans.map((l) => (
          <option key={l.id} value={l.id}>#{l.id} - {rupees(l.principalPaise)} @ {l.annualInterestRate}% for {l.tenureMonths} months</option>
        ))}
      </select>
      <p style={{ color: msg.startsWith('Error') ? 'crimson' : 'green' }}>{msg}</p>
      {detail && (
        <>
          <h2>Current position</h2>
          <ul>
            <li>Outstanding principal: {rupees(pos.outstandingPrincipalPaise)}</li>
            <li>Next due: {pos.nextDueDate || 'none'} ({rupees(pos.nextDueAmountPaise)})</li>
            <li><b>Overdue amount: {rupees(pos.overdueAmountPaise)}</b></li>
          </ul>
          <form onSubmit={pay}>
            <input placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />{' '}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />{' '}
            <button type="submit">Record payment</button>
          </form>
          <h2>Schedule</h2>
          <table border="1" cellPadding="4" style={{ borderCollapse: 'collapse' }}>
            <thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {detail.schedule.map((s) => (
                <tr key={s.installmentNumber} style={s.overdue ? { background: '#fdd' } : undefined}>
                  <td>{s.installmentNumber}</td><td>{s.dueDate}</td>
                  <td>{rupees(s.principalAmountPaise)}</td><td>{rupees(s.interestAmountPaise)}</td>
                  <td>{rupees(s.totalDuePaise)}</td><td>{rupees(s.amountPaidPaise)}</td>
                  <td>{s.overdue ? 'OVERDUE ' : ''}{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
