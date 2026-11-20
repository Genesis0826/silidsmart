import type { ReactNode } from 'react';
import { pesos, type TenantBill } from '../utils/tenantBillingApi';
export function TenantBillCard({ bill, children }: { bill: TenantBill; children?: ReactNode }) {
  return <article className="tenant-statement" aria-label={`Statement for ${bill.unitLabel} ${bill.billingMonth}`}>
    <h3>{bill.unitLabel} · {bill.billingMonth}</h3>
    <p>{bill.propertyName} · Issued by {bill.ownerName}</p>
    <p><strong>{bill.status}</strong> · Due {bill.dueDate}</p>
    <table className="tenant-charge-table"><caption className="sr-only">Statement charges</caption><thead><tr><th>Charge</th><th>Amount</th><th>Record</th></tr></thead>
      <tbody>{bill.items.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{pesos(item.amountPhp)}</td><td>{item.markedPaidManually ? 'Paid (manual)' : 'Unpaid'}</td></tr>)}</tbody></table>
    <p>Recorded total: <strong>{pesos(bill.totalPhp)}</strong> · Marked paid: {pesos(bill.markedPaidPhp)}</p>
    <p className="tenant-total">Amount due: <strong>{pesos(bill.amountDuePhp)}</strong></p>
    <p>Only the charges listed here are included. Missing utilities are not assumed free. Contact the owner about corrections.</p>
    {bill.note && <p>Note: {bill.note}</p>}
    {bill.paymentDate && <p>Owner recorded receipt on {bill.paymentDate}.</p>}
    {bill.sandboxStatus !== 'Not started' && <p>Gateway test: <strong>{bill.sandboxStatus === 'SandboxPaid' ? 'Completed in sandbox' : bill.sandboxStatus}</strong>. Test money does not settle this bill.{bill.sandboxPaymentId && <> Test reference: {bill.sandboxPaymentId}</>}</p>}
    {children}
  </article>;
}
