import { useRef, useState } from 'react';
import type { Property, Unit, UtilityInput, UtilityRecord } from '../types';
import './PrivateLedger.css';

interface Props {
  units: Unit[];
  properties: Property[];
  records: UtilityRecord[];
  onSave: (bill: UtilityInput, id?: string) => Promise<boolean>;
}

const blankBill = (): UtilityInput => ({
  unitId: '', utilityType: 'Electricity', billingMonth: '', amountPhp: 0,
  dueDate: '', paymentStatus: 'Due', paymentDate: null, reference: '',
});
const pesos = (amount: number) => amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

export function UtilityTracker({ units, properties, records, onSave }: Props) {
  const [form, setForm] = useState<UtilityInput>(blankBill);
  const [editingId, setEditingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const formRef = useRef<HTMLFormElement>(null);
  const selectedUnit = units.some(unit => unit.id === form.unitId) ? form.unitId : units[0]?.id || '';
  const filtered = records.filter(bill => (!monthFilter || bill.billingMonth === monthFilter)
    && (statusFilter === 'All' || bill.paymentStatus === statusFilter));
  const total = records.reduce((sum, bill) => sum + Math.round(bill.amountPhp * 100), 0) / 100;
  const markedPaid = records.filter(bill => bill.paymentStatus === 'Paid')
    .reduce((sum, bill) => sum + Math.round(bill.amountPhp * 100), 0) / 100;

  return <section className="card" style={{ padding: '24px' }} aria-labelledby="utility-tracker-title">
    <h2 id="utility-tracker-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Utility Tracker</h2>
    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
      Private electricity, water and Wi-Fi bills for your units. Payment dates, references and statuses are entered by you;
      SilidSmart does not collect or verify utility payments. Utility amounts are excluded from the 5% short-stay rent commission.
    </p>
    <p className="mono-num" style={{ marginBottom: '20px' }}>
      All recorded bills: <strong>{pesos(total)}</strong> · Marked paid: <strong>{pesos(markedPaid)}</strong> · Unpaid: <strong>{pesos(Math.round((total - markedPaid) * 100) / 100)}</strong>
    </p>
    {!units.length ? <p>Add a unit before recording a utility bill.</p> : <form ref={formRef} onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setNotice(''); setFailed(false);
      try {
        const ok = await onSave({ ...form, unitId: selectedUnit }, editingId);
        if (ok) {
          setForm(blankBill()); setEditingId(undefined);
          setNotice('Utility bill saved as a manual record. No payment was processed.');
        } else { setFailed(true); setNotice('Bill not saved. Check the action error above and correct the entries.'); }
      } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, marginBottom: '12px' }}>{editingId ? 'Edit utility bill' : 'Record utility bill'}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
          <label htmlFor="utility-unit">Unit
            <select id="utility-unit" className="select" disabled={!!editingId} value={selectedUnit} onChange={event => setForm({ ...form, unitId: event.target.value })}>
              {units.map(unit => <option key={unit.id} value={unit.id}>{properties.find(property => property.id === unit.propertyId)?.name} · {unit.unitLabel}</option>)}
            </select>
          </label>
          <label htmlFor="utility-type">Utility type
            <select id="utility-type" className="select" disabled={!!editingId} value={form.utilityType} onChange={event => setForm({ ...form, utilityType: event.target.value as UtilityInput['utilityType'] })}>
              <option>Electricity</option><option>Water</option><option>Wi-Fi</option>
            </select>
          </label>
          <label htmlFor="utility-month">Billing month
            <input id="utility-month" className="input" type="month" required disabled={!!editingId} value={form.billingMonth} onChange={event => setForm({ ...form, billingMonth: event.target.value })} />
          </label>
          <label htmlFor="utility-amount">Bill amount (₱)
            <input id="utility-amount" className="input mono-num" type="number" min="0.01" max="10000000" step="0.01" required value={form.amountPhp || ''} onChange={event => setForm({ ...form, amountPhp: Number(event.target.value) })} />
          </label>
          <label htmlFor="utility-due">Due date
            <input id="utility-due" className="input" type="date" required value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} />
          </label>
          <label htmlFor="utility-status">Payment status (manual)
            <select id="utility-status" className="select" value={form.paymentStatus} onChange={event => {
              const status = event.target.value as UtilityInput['paymentStatus'];
              setForm({ ...form, paymentStatus: status, paymentDate: null, reference: '' });
            }}><option>Due</option><option>Overdue</option><option>Paid</option></select>
          </label>
          {form.paymentStatus === 'Paid' && <>
            <label htmlFor="utility-payment-date">Payment date
              <input id="utility-payment-date" className="input" type="date" required value={form.paymentDate || ''} onChange={event => setForm({ ...form, paymentDate: event.target.value })} />
            </label>
            <label htmlFor="utility-reference">Payment reference (optional)
              <input id="utility-reference" className="input" maxLength={120} value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} />
            </label>
          </>}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary">{busy ? 'Saving…' : editingId ? 'Save bill changes' : 'Add utility bill'}</button>
          {editingId && <button type="button" className="btn btn-outline" onClick={() => { setForm(blankBill()); setEditingId(undefined); setNotice(''); }}>Cancel edit</button>}
        </div>
      </fieldset>
    </form>}
    {notice && <p role={failed ? 'alert' : 'status'} style={{ marginTop: '12px', color: failed ? '#991B1B' : 'var(--status-green)' }}>{notice}</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
      <label htmlFor="utility-month-filter">Filter billing month
        <input id="utility-month-filter" className="input" type="month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} />
      </label>
      <label htmlFor="utility-status-filter">Filter payment status
        <select id="utility-status-filter" className="select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
          <option>All</option><option>Paid</option><option>Due</option><option>Overdue</option>
        </select>
      </label>
      <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-end' }} onClick={() => { setMonthFilter(''); setStatusFilter('All'); }}>Clear filters</button>
    </div>
    <div style={{ overflowX: 'auto', marginTop: '20px' }}>
      <table className="private-ledger-table">
        <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: '10px' }}>Private utility records · {filtered.length} shown</caption>
        <thead><tr><th>Property / unit</th><th>Utility / month</th><th>Amount / due</th><th>Status</th><th>Payment date / reference</th><th>Action</th></tr></thead>
        <tbody>
          {!filtered.length && <tr><td colSpan={6}>No utility bills match these filters.</td></tr>}
          {filtered.map(bill => {
            const unit = units.find(item => item.id === bill.unitId);
            return <tr key={bill.id}>
              <td>{properties.find(property => property.id === unit?.propertyId)?.name}<br />{unit?.unitLabel}</td>
              <td>{bill.utilityType}<br /><span className="mono-num">{bill.billingMonth}</span></td>
              <td className="mono-num">{pesos(bill.amountPhp)}<br />Due {bill.dueDate}</td>
              <td><span className={`badge ${bill.paymentStatus === 'Paid' ? 'badge-paid' : bill.paymentStatus === 'Overdue' ? 'badge-overdue' : 'badge-due'}`}>{bill.paymentStatus}</span><br /><small>Owner-reported</small></td>
              <td>{bill.paymentDate || 'Not marked paid'}<br />{bill.reference || 'No reference'}</td>
              <td><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => {
                setEditingId(bill.id); setNotice('');
                setForm({ unitId: bill.unitId, utilityType: bill.utilityType, billingMonth: bill.billingMonth, amountPhp: bill.amountPhp,
                  dueDate: bill.dueDate, paymentStatus: bill.paymentStatus, paymentDate: bill.paymentDate, reference: bill.reference });
                formRef.current?.scrollIntoView({ block: 'start' });
              }}>Edit bill</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </section>;
}
