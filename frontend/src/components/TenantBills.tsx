import { useBillingWorkspace } from '../hooks/useBillingWorkspace';
import type { RenterBillingWorkspace } from '../utils/tenantBillingApi';
import { TenantBillCard } from './TenantBillCard';
import './TenantBilling.css';

export function TenantBills() {
  const { data, error, notice, busy, loading, refresh, run } = useBillingWorkspace<RenterBillingWorkspace>('/api/tenant/billing');
  return <section className="container tenant-billing-page" aria-labelledby="my-bills-title">
    <h1 id="my-bills-title">My bills</h1>
    <p>Your owner must confirm the actual tenancy, invite your registered account, and publish a statement after you accept. Viewing approval alone does not give billing access.</p>
    <button className="btn btn-secondary" disabled={busy} onClick={refresh}>Refresh my bills</button>
    {loading && <p role="status">Loading private bills…</p>}
    {error && <p role="alert" className="billing-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data && <>
      <aside className="billing-notice"><strong>Payment gateway: {data.gateway.mode}</strong><p>{data.gateway.checkoutEnabled ? 'Test checkout is available. It uses no real money and does not settle the amount due.' : 'Test checkout needs setup. Your owner can still publish bills and record payments received outside SilidSmart.'}</p><p>Live payments and owner payouts are unavailable.</p></aside>
      {data.invitations.map(invitation => <article className="tenant-statement" key={invitation.id}>
        <h2>Billing invitation</h2><p>{invitation.ownerName} invited you for {invitation.propertyName}, {invitation.unitLabel}.</p>
        <form onSubmit={event => { event.preventDefault(); void run(`/api/tenant/tenant-links/${invitation.id}`, { action: 'Accept', tenancyConfirmed: true }, 'PATCH', 'Billing access accepted. The owner can now publish your statement.'); }}>
          <label className="billing-check"><input type="checkbox" required disabled={busy}/>I confirm that I am the tenant of this unit.</label>
          <div className="billing-actions"><button className="btn btn-primary" disabled={busy}>Accept billing access</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void run(`/api/tenant/tenant-links/${invitation.id}`, { action: 'Decline' }, 'PATCH', 'Invitation declined.')}>Decline invitation</button></div>
        </form>
      </article>)}
      {!data.bills.length && <p>No published statements yet. Ask your owner to confirm your tenancy and publish your bill.</p>}
      {data.bills.map(bill => <TenantBillCard bill={bill} key={bill.id}>
        {bill.state === 'Issued' && bill.amountDuePhp > 0 && <div className="billing-actions">
          <button className="btn btn-primary" disabled={busy || !data.gateway.checkoutEnabled || ['SandboxPaid', 'Expired'].includes(bill.sandboxStatus)} onClick={async () => {
            const result = await run<{ checkoutUrl: string; mode: string }>(`/api/tenant/bills/${bill.id}/checkout`, {}, 'POST', 'Opening PayMongo sandbox checkout.');
            if (result?.mode === 'sandbox' && new URL(result.checkoutUrl).origin === 'https://checkout.paymongo.com') window.location.assign(result.checkoutUrl);
          }}>{data.gateway.checkoutEnabled ? 'Open PayMongo test checkout' : 'Checkout unavailable — setup required'}</button>
          {['Pending', 'Unknown', 'Creating'].includes(bill.sandboxStatus) && <>
            <button className="btn btn-secondary" disabled={busy || !data.gateway.checkoutEnabled} onClick={() => void run(`/api/tenant/bills/${bill.id}/reconcile`, {}, 'POST', 'Provider test status refreshed. Real rent records are unchanged.')}>Check test payment status</button>
            <button className="btn btn-secondary" disabled={busy || !data.gateway.checkoutEnabled} onClick={() => void run(`/api/tenant/bills/${bill.id}/reconcile`, { cancel: true }, 'POST', 'Test cancellation checked with provider.')}>Cancel test checkout</button>
          </>}
        </div>}
      </TenantBillCard>)}
    </>}
  </section>;
}
