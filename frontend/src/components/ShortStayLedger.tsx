import { useState } from 'react';
import type { Property, Unit, ShortStay, ShortStayInput } from '../types';
import { SHORT_STAY_COMMISSION_PERCENT } from '../utils/pricing';
import './PrivateLedger.css';

interface Props {
  units: Unit[];
  properties: Property[];
  stays: ShortStay[];
  onRecord: (stay: ShortStayInput) => Promise<boolean>;
  onUpdateStatus: (id: string, status: ShortStay['status']) => Promise<boolean>;
}

const pesos = (amount: number) => amount.toLocaleString('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
});

export function ShortStayLedger({ units, properties, stays, onRecord, onUpdateStatus }: Props) {
  const [unitId, setUnitId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [checkInDate, setCheckIn] = useState('');
  const [checkOutDate, setCheckOut] = useState('');
  const [rent, setRent] = useState('');
  const [source, setSource] = useState<ShortStayInput['source']>('SilidSmart');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const selectedUnit = units.some((unit) => unit.id === unitId) ? unitId : units[0]?.id || '';
  const totalCommission = stays.reduce((sum, stay) => sum + Math.round(stay.commissionPhp * 100), 0) / 100;
  const preview = source === 'SilidSmart'
    ? Math.round(Math.round(Number(rent) * 100) * SHORT_STAY_COMMISSION_PERCENT / 100) / 100 : 0;

  return (
    <section className="card" style={{ padding: '24px' }} aria-labelledby="short-stay-title">
      <h2 id="short-stay-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Short Stays & Commission</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
        Record completed stays arranged directly with guests. The proposed owner-paid fee is 5% of short-stay rent sourced through SilidSmart, on every plan including Free.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Manual records only. SilidSmart does not collect, deduct, remit, or verify rent or commission payments.
        Refundable deposits, taxes, and other charges are excluded. Cancelled stays and other-source stays have no commission.
        This ledger does not reserve dates, check calendar availability, or change occupancy; update unit occupancy separately.
      </p>
      <p className="mono-num" style={{ marginBottom: '20px' }}>
        <strong>Calculated commission on recorded stays: {pesos(totalCommission)}</strong><br />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Owner-reported basis; this is not collected revenue or a payment confirmation.</span>
      </p>
      {!units.length ? <p>Add a unit to your portfolio before recording a short stay.</p> : (
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setNotice(''); setBusy(true);
          try {
            const ok = await onRecord({ unitId: selectedUnit, guestName, checkInDate, checkOutDate, rentTotalPhp: Number(rent), source });
            if (ok) {
              setGuestName(''); setRent(''); setCheckIn(''); setCheckOut('');
              setNotice('Completed stay recorded. Commission calculated; no payment was processed.');
            }
          } finally { setBusy(false); }
        }}>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, marginBottom: '12px' }}>Record a completed short stay</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px' }}>
              <label htmlFor="stay-unit">Unit
                <select id="stay-unit" className="select" value={selectedUnit} onChange={(event) => setUnitId(event.target.value)}>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>
                    {properties.find((property) => property.id === unit.propertyId)?.name} · {unit.unitLabel}
                  </option>)}
                </select>
              </label>
              <label htmlFor="stay-guest">Guest name
                <input id="stay-guest" className="input" required maxLength={120} value={guestName} onChange={(event) => setGuestName(event.target.value)} />
              </label>
              <label htmlFor="stay-check-in">Check-in date
                <input id="stay-check-in" className="input" type="date" required value={checkInDate} onChange={(event) => setCheckIn(event.target.value)} />
              </label>
              <label htmlFor="stay-check-out">Check-out date
                <input id="stay-check-out" className="input" type="date" required min={checkInDate || undefined} value={checkOutDate} onChange={(event) => setCheckOut(event.target.value)} />
              </label>
              <label htmlFor="stay-rent">Total stay rent (₱)
                <input id="stay-rent" className="input mono-num" type="number" min="0.01" max="10000000" step="0.01" required value={rent} onChange={(event) => setRent(event.target.value)} />
              </label>
              <label htmlFor="stay-source">Source reported by owner
                <select id="stay-source" className="select" value={source} onChange={(event) => setSource(event.target.value as ShortStayInput['source'])}>
                  <option value="SilidSmart">SilidSmart inquiry / referral</option>
                  <option value="Other">Other source (no commission)</option>
                </select>
              </label>
            </div>
            <p className="mono-num" style={{ margin: '16px 0' }}>Commission preview: <strong>{pesos(Number.isFinite(preview) ? preview : 0)}</strong></p>
            <button type="submit" className="btn btn-primary">{busy ? 'Saving…' : 'Record completed stay'}</button>
          </fieldset>
        </form>
      )}
      {notice && <p role="status" style={{ marginTop: '12px', color: 'var(--status-green)' }}>{notice}</p>}
      <div style={{ overflowX: 'auto', marginTop: '24px' }}>
        <table className="private-ledger-table">
          <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: '10px' }}>Private short-stay records</caption>
          <thead><tr><th>Unit / guest</th><th>Dates</th><th>Rent</th><th>Source</th><th>Commission</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {!stays.length && <tr><td colSpan={7}>No completed short stays recorded yet.</td></tr>}
            {stays.map((stay) => <tr key={stay.id}>
              <td>{units.find((unit) => unit.id === stay.unitId)?.unitLabel}<br />{stay.guestName}</td>
              <td className="mono-num">{stay.checkInDate}<br />to {stay.checkOutDate}</td>
              <td className="mono-num">{pesos(stay.rentTotalPhp)}</td>
              <td>{stay.source}</td>
              <td className="mono-num">{pesos(stay.commissionPhp)}<br /><small>{stay.commissionPercent}% policy</small></td>
              <td>{stay.status}</td>
              <td><button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
                setBusy(true); setNotice('');
                try { await onUpdateStatus(stay.id, stay.status === 'Completed' ? 'Cancelled' : 'Completed'); }
                finally { setBusy(false); }
              }}>{stay.status === 'Completed' ? 'Mark cancelled' : 'Restore completed'}</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
