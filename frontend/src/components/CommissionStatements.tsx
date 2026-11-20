import { useState } from 'react';
import type { CommissionStatement, CommissionRemittanceInput, CommissionReviewInput, Owner, ShortStay } from '../types';
import './PrivateLedger.css';

interface Props {
  statements: CommissionStatement[];
  stays?: ShortStay[];
  owners?: Owner[];
  onIssue?: (month: string) => Promise<boolean>;
  onSubmit?: (id: string, input: CommissionRemittanceInput) => Promise<boolean>;
  onReview?: (id: string, input: CommissionReviewInput) => Promise<boolean>;
  onVoid?: (id: string, reason: string) => Promise<boolean>;
}
const pesos = (n: number) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const previousMonth = () => {
  const [y, m] = today().split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

export function CommissionStatements({ statements, stays = [], owners = [], onIssue, onSubmit, onReview, onVoid }: Props) {
  const [month, setMonth] = useState(previousMonth);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{ kind: 'submit' | 'review' | 'void'; id: string } | null>(null);
  const [method, setMethod] = useState<CommissionRemittanceInput['method']>('Bank transfer');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [decision, setDecision] = useState<CommissionReviewInput['decision']>('Verified');
  const [receivedDate, setReceivedDate] = useState(today);
  const [fundsReceived, setFundsReceived] = useState(false);
  const [note, setNote] = useState('');
  const run = async (action: () => Promise<boolean>, message: string) => {
    if (busy) return;
    setBusy(true); setNotice('');
    try { if (await action()) { setEditor(null); setNotice(message); } } finally { setBusy(false); }
  };
  const open = (kind: 'submit' | 'review' | 'void', id: string) => {
    setEditor({ kind, id }); setReference(''); setNote(''); setFundsReceived(false);
    setDecision('Verified'); setReceivedDate(today()); setPaymentDate(today()); setNotice('');
  };
  const eligible = stays.filter(s => s.checkOutDate.startsWith(month) && s.source === 'SilidSmart' && s.status === 'Completed');
  const preview = eligible.reduce((sum, s) => sum + Math.round(s.commissionPhp * 100), 0) / 100;
  const months = [...new Set(statements.map(s => s.billingMonth))];
  const visible = statements.filter(s => filter === 'all' || s.billingMonth === filter);
  return <section className="card commission-workspace" aria-labelledby="commission-title">
    <h2 id="commission-title">Monthly Commission Statements</h2>
    <p>5% of accommodation rent for completed SilidSmart-sourced short stays only. Long-term rent and utilities have no commission. Group by checkout month in Philippine time. Due on the 10th of the next month.</p>
    <p className="commission-note">Rent goes directly to the owner or authorized property manager. Owners remit platform commission separately, outside SilidSmart. These are manual records with staff review, with no payment gateway or automatic deductions. Subscription charges, deposits, taxes and utilities are excluded from these statements.</p>
    {onIssue && <form className="commission-editor" onSubmit={e => {
      e.preventDefault(); void run(() => onIssue(month), 'Statement issued. Its checkout month is now locked against changes.');
    }}>
      <fieldset disabled={busy}>
        <legend>Issue a completed month</legend>
        <label htmlFor="commission-month">Checkout month
          <input id="commission-month" className="input" type="month" min="2000-01" max={previousMonth()} required value={month} onChange={e => setMonth(e.target.value)} />
        </label>
        <p className="mono-num">Running preview: {eligible.length} eligible stays · {pesos(preview)} commission</p>
        <p className="commission-note">Check the month’s records before issuing. An administrator can void an unpaid statement for correction. Verified statements stay locked. An existing issued statement is returned unchanged.</p>
        <button className="btn btn-primary" disabled={busy || !month || month >= today().slice(0, 7)}>Issue monthly statement</button>
      </fieldset>
    </form>}
    <label htmlFor="commission-filter">Show statements
      <select id="commission-filter" className="select" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All months</option>{months.map(m => <option key={m}>{m}</option>)}
      </select>
    </label>
    {notice && <p role="status" className="commission-success">{notice}</p>}
    {!visible.length && <p className="commission-empty">No statements yet. Owners can issue a statement after a calendar month ends.</p>}
    {visible.map(s => <article key={s.id} className="commission-statement" aria-label={`Commission statement ${s.billingMonth} version ${s.version}`}>
      <div className="commission-heading">
        <div><h3>{s.billingMonth} · Version {s.version}</h3>
          {owners.length > 0 && <p>{owners.find(o => o.id === s.ownerId)?.displayName || s.ownerId}</p>}
          <small className="mono-num">Statement {s.id.slice(0, 8)} · Due {s.dueDate}</small>
        </div>
        <span className={`badge ${s.paymentStatus === 'Verified' || s.paymentStatus === 'No commission' ? 'badge-success' : s.paymentStatus === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}>{s.paymentStatus}</span>
      </div>
      <p className="mono-num">Eligible rent: <strong>{pesos(s.rentTotalPhp)}</strong> · Commission: <strong>{pesos(s.commissionPhp)}</strong> · Outstanding: <strong>{pesos(s.outstandingPhp)}</strong></p>
      <small className="commission-note">Issued from owner-reported records. Source links and staff remittance review do not independently verify the stay or its rent.</small>
      {s.voidReason && <p>Voided: {s.voidReason}</p>}
      <details className="commission-details"><summary>Statement items ({s.items.length})</summary>
        <div className="commission-table-scroll"><table className="private-ledger-table">
          <thead><tr><th>Property / unit</th><th>Checkout</th><th>Rent</th><th>Source / status</th><th>Commission</th><th>Inquiry link</th></tr></thead>
          <tbody>{!s.items.length && <tr><td colSpan={6}>No stays recorded for this month. No commission due.</td></tr>}
            {s.items.map(i => <tr key={i.stayId}><td>{i.propertyName}<br />{i.unitLabel}</td><td>{i.checkOutDate}</td><td>{pesos(i.rentTotalPhp)}</td><td>{i.source}<br />{i.status}</td><td>{pesos(i.commissionPhp)}</td><td>{i.inquiryId || 'Not linked'}</td></tr>)}
          </tbody></table></div>
      </details>
      {s.remittances.map(r => <div key={r.id} className="commission-remittance">
        <strong>{r.status} transfer report</strong>
        <p className="mono-num">{pesos(r.amountPhp)} · {r.method} · {r.paymentDate}</p><p className="commission-reference">Reference: {r.reference}</p>
        {r.reviewNote && <p>Staff note: {r.reviewNote}</p>}{r.receivedDate && <p>Staff-confirmed receipt date: {r.receivedDate}</p>}
        {onReview && r.status === 'Submitted' && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => open('review', r.id)}>Review remittance</button>}
        {editor?.kind === 'review' && editor.id === r.id && onReview && <form className="commission-editor" onSubmit={e => {
          e.preventDefault(); void run(() => onReview(r.id, { decision, note, receivedDate, fundsReceived }), decision === 'Verified' ? 'Receipt recorded as verified by staff. No online payment was processed.' : 'Report returned for correction. The owner can submit another report.');
        }}><fieldset disabled={busy}><legend>Review external remittance</legend>
          <label htmlFor="commission-decision">Decision<select id="commission-decision" className="select" value={decision} onChange={e => setDecision(e.target.value as CommissionReviewInput['decision'])}><option>Verified</option><option value="Rejected">Return for correction</option></select></label>
          {decision === 'Verified' && <><label htmlFor="commission-received">Actual received date<input id="commission-received" className="input" type="date" min={r.paymentDate} max={today()} required value={receivedDate} onChange={e => setReceivedDate(e.target.value)} /></label>
            <label className="commission-checkbox"><input type="checkbox" required checked={fundsReceived} onChange={e => setFundsReceived(e.target.checked)} />I checked actual funds received against this statement, amount and transfer reference.</label></>}
          <label htmlFor="commission-review-note">Review note<textarea id="commission-review-note" className="input" required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
          <div className="commission-actions"><button className="btn btn-primary">Save review</button><button type="button" className="btn btn-outline" onClick={() => setEditor(null)}>Cancel</button></div>
        </fieldset></form>}
      </div>)}
      {onSubmit && s.state === 'Issued' && s.commissionPhp > 0 && !['Under review', 'Verified'].includes(s.paymentStatus) &&
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => open('submit', s.id)}>Report external remittance</button>}
      {editor?.kind === 'submit' && editor.id === s.id && onSubmit && <form className="commission-editor" onSubmit={e => {
        e.preventDefault(); void run(() => onSubmit(s.id, { amountPhp: s.commissionPhp, method, reference, paymentDate }), 'Transfer reported. Commission remains outstanding until staff verifies actual receipt.');
      }}><fieldset disabled={busy}><legend>Report a transfer already made outside SilidSmart</legend>
        <p className="mono-num">Exact transfer amount: <strong>{pesos(s.commissionPhp)}</strong></p>
        <p className="commission-note">Use the collection details separately agreed with the team. No destination account or checkout is configured here. For this prototype, use sample reports only. One transfer per statement; partial and combined payments are outside scope.</p>
        <label htmlFor="commission-method">Transfer method<select id="commission-method" className="select" value={method} onChange={e => setMethod(e.target.value as CommissionRemittanceInput['method'])}><option>Bank transfer</option><option>GCash</option></select></label>
        <label htmlFor="commission-payment-date">Payment date<input id="commission-payment-date" className="input" type="date" max={today()} required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></label>
        <label htmlFor="commission-reference">Transfer reference<input id="commission-reference" className="input" required maxLength={120} value={reference} onChange={e => setReference(e.target.value)} /></label>
        <div className="commission-actions"><button className="btn btn-primary">Submit for staff review</button><button type="button" className="btn btn-outline" onClick={() => setEditor(null)}>Cancel</button></div>
      </fieldset></form>}
      {onVoid && s.state === 'Issued' && !s.remittances.some(r => r.status === 'Submitted' || r.status === 'Verified') &&
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => open('void', s.id)}>Void for correction</button>}
      {editor?.kind === 'void' && editor.id === s.id && onVoid && <form className="commission-editor" onSubmit={e => {
        e.preventDefault(); void run(() => onVoid(s.id, note), 'Statement voided. The owner may correct records and issue the next version.');
      }}><fieldset disabled={busy}><legend>Void unpaid statement</legend>
        <label htmlFor="commission-void-note">Correction reason<textarea id="commission-void-note" className="input" required maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
        <div className="commission-actions"><button className="btn btn-primary">Confirm void</button><button type="button" className="btn btn-outline" onClick={() => setEditor(null)}>Cancel</button></div>
      </fieldset></form>}
    </article>)}
  </section>;
}
