import { useEffect, useState } from 'react';
import type { Unit, DirectorySettings } from '../types';

interface Props {
  unit: Unit;
  onClose: () => void;
  onSave: (id: string, settings: DirectorySettings) => Promise<boolean>;
}

export function UnitDirectorySettings({ unit, onClose, onSave }: Props) {
  const [published, setPublished] = useState(unit.published);
  const [expectedDate, setExpectedDate] = useState(unit.expectedAvailableFrom || '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [busy, onClose]);

  return <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
    <section className="modal-content" role="dialog" aria-modal="true" aria-labelledby="directory-settings-title"
      style={{ maxWidth: '500px' }} onClick={(event) => event.stopPropagation()}>
      <div className="modal-header">
        <h2 id="directory-settings-title" style={{ color: '#fff', fontSize: '1.1rem' }}>Directory settings</h2>
        <button type="button" aria-label="Close directory settings" disabled={busy} onClick={onClose} style={{ color: '#fff' }}>Close</button>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setFailed(false);
        try { if (await onSave(unit.id, { published, expectedAvailableFrom: unit.status === 'Occupied' ? expectedDate || null : null })) onClose(); else setFailed(true); }
        finally { setBusy(false); }
      }}>
        <fieldset className="modal-body" disabled={busy} style={{ border: 0, display: 'grid', gap: '14px', margin: 0 }}>
          <p><strong>{unit.unitLabel}</strong> · {unit.status}</p>
          <label htmlFor="unit-publication">Directory publication
            <select autoFocus id="unit-publication" className="select" value={published ? 'published' : 'hidden'} onChange={(event) => setPublished(event.target.value === 'published')}>
              <option value="published">Published in public directory</option>
              <option value="hidden">Hidden from public directory</option>
            </select>
          </label>
          {unit.status === 'Occupied' && <label htmlFor="unit-expected-date">Expected available from (optional)
            <input id="unit-expected-date" className="input" type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
          </label>}
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Published vacant units appear in Available now. Published occupied units appear only in All published units, labelled unavailable now.
            The optional date is your estimate, not a contract date or guarantee. Confirm vacancy manually; the date never changes occupancy automatically.
          </p>
          <button type="submit" className="btn btn-primary">{busy ? 'Saving…' : 'Save directory settings'}</button>
          {failed && <p role="alert" style={{ color: '#991B1B' }}>Directory settings were not saved. Check your connection and entries, then try again.</p>}
        </fieldset>
      </form>
    </section>
  </div>;
}
