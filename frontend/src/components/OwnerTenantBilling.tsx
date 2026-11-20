import { useState } from 'react';
import type { Tenant, Unit, RentRecord, UtilityRecord } from '../types';
import { useBillingWorkspace } from '../hooks/useBillingWorkspace';
import { rentMonthKey } from '../utils/billing';
import { pesos, todayManila, type OwnerBillingWorkspace, type TenantBill } from '../utils/tenantBillingApi';
import { TenantBillCard } from './TenantBillCard';
import './TenantBilling.css';

export function OwnerTenantBilling({ tenants, units, rent, utilities, onRecordsChanged }: {
  tenants: Tenant[]; units: Unit[]; rent: RentRecord[]; utilities: UtilityRecord[]; onRecordsChanged: () => void;
}) {
  const { data, error, notice, busy, loading, refresh, run } = useBillingWorkspace<OwnerBillingWorkspace>('/api/owner/tenant-billing');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [inviteConfirmed, setInviteConfirmed] = useState(false);
  const [chargesConfirmed, setChargesConfirmed] = useState(false);
  const [linkId, setLinkId] = useState('');
  const [month, setMonth] = useState(() => todayManila().slice(0, 7));
  const [dueDate, setDueDate] = useState(todayManila);
  const [rentId, setRentId] = useState('');
  const [utilityIds, setUtilityIds] = useState<string[]>([]);
  const [action, setAction] = useState<{ bill: TenantBill; type: 'Void' | 'PaidExternal' } | null>(null);
  const [reason, setReason] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayManila);
  const [reference, setReference] = useState('');
  const link = data?.links.find(l => l.id === linkId && l.state === 'Active');
  const availableRent = rent.filter(r => r.unitId === link?.unitId && r.tenantName === link?.tenantName && rentMonthKey(r.month) === month);
  const availableUtilities = utilities.filter(u => u.unitId === link?.unitId && u.billingMonth === month);
  const selectedRent = availableRent.find(r => r.id === rentId);
  const selectedUtilities = availableUtilities.filter(u => utilityIds.includes(u.id));
  const totalCents = Math.round((selectedRent?.amountDue || 0) * 100) + selectedUtilities.reduce((s, u) => s + Math.round(u.amountPhp * 100), 0);
  const dueCents = (selectedRent?.paymentStatus === 'Paid' ? 0 : Math.round((selectedRent?.amountDue || 0) * 100)) + selectedUtilities.filter(u => u.paymentStatus !== 'Paid').reduce((s, u) => s + Math.round(u.amountPhp * 100), 0);
  const clearCharges = () => { setRentId(''); setUtilityIds([]); setChargesConfirmed(false); };
  return <section className="card tenant-billing-owner" aria-labelledby="tenant-billing-title">
    <h2 id="tenant-billing-title">Tenant Billing</h2>
    <p>Confirm the actual tenancy, invite the renter’s registered account, then publish a statement after they accept in My bills. Approving a viewing does not grant access. Check the recipient before publishing; prototype email addresses are not independently verified.</p>
    <button className="btn btn-secondary" disabled={busy} onClick={refresh}>Refresh billing access</button>
    {loading && <p role="status">Loading billing workspace…</p>}{error && <p role="alert" className="billing-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data && <>
      <aside className="billing-notice"><strong>Gateway: {data.gateway.mode}</strong><p>{data.gateway.checkoutEnabled ? 'Test checkout is enabled. Test payments do not settle real bills or pay out to owners.' : 'Test checkout needs administrator setup. Bills and manual receipt records work without it. Live payments are unavailable.'}</p></aside>
      <form className="billing-form" onSubmit={async event => { event.preventDefault(); const result = await run('/api/owner/tenant-links', { tenantId, email, tenancyConfirmed: inviteConfirmed }, 'POST', 'Invitation is available in the renter’s My bills page. No email was sent.'); if (result) { setEmail(''); setInviteConfirmed(false); } }}>
        <h3>1. Invite a tenant</h3>
        <label>Occupied tenant<select aria-label="Occupied tenant" className="input" required value={tenantId} disabled={busy} onChange={e => { setTenantId(e.target.value); setInviteConfirmed(false); }}><option value="">Choose the current tenant</option>{tenants.filter(t => units.some(u => u.id === t.unitId && u.status === 'Occupied')).map(t => <option value={t.id} key={t.id}>{t.name} · {units.find(u => u.id === t.unitId)?.unitLabel}</option>)}</select></label>
        <label>Renter’s registered email<input className="input" type="email" required maxLength={254} value={email} disabled={busy} onChange={e => { setEmail(e.target.value); setInviteConfirmed(false); }}/></label>
        <label className="billing-check"><input type="checkbox" required disabled={busy} checked={inviteConfirmed} onChange={e => setInviteConfirmed(e.target.checked)}/>I checked this account belongs to the actual tenant.</label>
        <button className="btn btn-primary" disabled={busy}>Invite billing access</button>
      </form>
      <h3>Billing access</h3>
      {!data.links.length && <p>No tenant accounts linked yet.</p>}
      {data.links.map(l => <div className="tenant-statement" key={l.id}><strong>{l.tenantName} · {l.unitLabel}</strong><p>{l.renterEmail} · {l.state}</p>{['Invited', 'Active', 'Ended'].includes(l.state) && <button className="btn btn-secondary" disabled={busy} onClick={() => void run(`/api/owner/tenant-links/${l.id}`, { action: 'Revoke' }, 'PATCH', 'Billing access revoked. Statements are retained in the owner workspace.')}>Revoke access for {l.renterName}</button>}</div>)}
      <form className="billing-form" onSubmit={async event => { event.preventDefault(); const result = await run('/api/owner/tenant-bills', { linkId, billingMonth: month, dueDate, rentRecordId: selectedRent?.id, utilityRecordIds: selectedUtilities.map(u => u.id), chargesConfirmed }, 'POST', 'Statement published privately to the linked tenant.'); if (result) clearCharges(); }}>
        <h3>2. Publish a monthly statement</h3>
        <label>Accepted tenant account<select aria-label="Accepted tenant account" className="input" required value={linkId} disabled={busy} onChange={e => { setLinkId(e.target.value); clearCharges(); }}><option value="">Choose accepted billing access</option>{data.links.filter(l => l.state === 'Active').map(l => <option key={l.id} value={l.id}>{l.tenantName} · {l.unitLabel} · {l.renterEmail}</option>)}</select></label>
        <label>Statement month<input className="input" type="month" required value={month} disabled={busy} onChange={e => { setMonth(e.target.value); clearCharges(); }}/></label>
        <label>Statement due date<input className="input" type="date" required value={dueDate} disabled={busy} onChange={e => { setDueDate(e.target.value); setChargesConfirmed(false); }}/></label>
        <label>Recorded rent<select aria-label="Recorded rent" className="input" value={rentId} disabled={busy || !link} onChange={e => { setRentId(e.target.value); setChargesConfirmed(false); }}><option value="">Do not include rent</option>{availableRent.map(r => <option key={r.id} value={r.id}>{r.month} · {pesos(r.amountDue)} · {r.paymentStatus}</option>)}</select></label>
        <fieldset disabled={busy || !link}><legend>Recorded utilities to include</legend>{!availableUtilities.length && <p>No utilities recorded for this unit/month.</p>}{availableUtilities.map(u => <label className="billing-check" key={u.id}><input type="checkbox" checked={utilityIds.includes(u.id)} onChange={e => { setUtilityIds(ids => e.target.checked ? [...ids, u.id] : ids.filter(id => id !== u.id)); setChargesConfirmed(false); }}/>{u.utilityType} · {pesos(u.amountPhp)} · {u.paymentStatus}</label>)}</fieldset>
        <p>Publish only this tenancy’s charges. Add missing bills in Utility Tracker or Rent Ledger first. Each issued statement locks its selected records until voided or settled.</p>
        <p>Selected total: <strong>{pesos(totalCents / 100)}</strong> · Amount due: <strong>{pesos(dueCents / 100)}</strong></p>
        <label className="billing-check"><input type="checkbox" required disabled={busy} checked={chargesConfirmed} onChange={e => setChargesConfirmed(e.target.checked)}/>I checked the recipient, billing period, amounts and prior payments.</label>
        <button className="btn btn-primary" disabled={busy || !link || totalCents <= 0}>Publish tenant statement</button>
      </form>
      <h3>Published statements</h3>{!data.bills.length && <p>No tenant statements published.</p>}
      {data.bills.map(bill => <TenantBillCard key={bill.id} bill={bill}>{bill.state === 'Issued' && <div className="billing-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => { setAction({ bill, type: 'Void' }); setReason(''); }}>Void for correction</button>{bill.amountDuePhp > 0 && <button className="btn btn-secondary" disabled={busy} onClick={() => { setAction({ bill, type: 'PaidExternal' }); setReference(''); }}>Record payment received outside SilidSmart</button>}</div>}</TenantBillCard>)}
      {action && <form className="billing-form" aria-label="Statement action" onSubmit={async event => {
        event.preventDefault(); const result = await run(`/api/owner/tenant-bills/${action.bill.id}`, action.type === 'Void' ? { action: 'Void', reason } : { action: 'PaidExternal', fundsReceived: true, paymentDate, reference }, 'PATCH', action.type === 'Void' ? 'Statement voided. Correct the source records before reissuing.' : 'Receipt recorded manually. Included unpaid rent and utility records were marked paid. No commission was charged.');
        if (result) { setAction(null); onRecordsChanged(); }
      }}>
        <h3>{action.type === 'Void' ? 'Void statement for correction' : 'Record full payment received'} · {action.bill.unitLabel}</h3>
        {action.type === 'Void' ? <label>Reason<input className="input" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)}/></label> : <>
          <p>Confirm receipt of the full outstanding {pesos(action.bill.amountDuePhp)} outside this app. This does not verify a bank transfer. Partial payments are not supported.</p>
          <label>Payment date<input className="input" required type="date" max={todayManila()} value={paymentDate} onChange={e => setPaymentDate(e.target.value)}/></label>
          <label>Receipt reference (optional)<input className="input" maxLength={120} value={reference} onChange={e => setReference(e.target.value)}/></label>
          <label className="billing-check"><input type="checkbox" required/>I verified receipt of the full amount outside SilidSmart.</label>
        </>}
        <div className="billing-actions"><button className="btn btn-primary" disabled={busy}>Confirm statement action</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setAction(null)}>Cancel</button></div>
      </form>}
    </>}
  </section>;
}
