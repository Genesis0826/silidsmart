export interface BillingGateway {
  checkoutEnabled: boolean;
  mode: string;
  message: string;
  livePaymentsEnabled: false;
  ownerSplitEnabled: false;
}
export interface BillingLink {
  id: string; tenantId: string | null; unitId: string | null;
  tenantName: string; propertyName: string; unitLabel: string;
  renterName: string; renterEmail: string;
  state: 'Invited' | 'Active' | 'Ended' | 'Declined' | 'Revoked';
}
export interface TenantBill {
  id: string; linkId: string; billingMonth: string; dueDate: string;
  propertyName: string; unitLabel: string; ownerName: string; tenantName: string;
  items: { label: string; amountPhp: number; markedPaidManually: boolean }[];
  totalPhp: number; markedPaidPhp: number; amountDuePhp: number;
  state: 'Issued' | 'Void' | 'PaidExternal'; status: string; note: string;
  paymentDate: string | null; sandboxStatus: string; sandboxPaymentId: string | null;
  proposedOnlineCommissionPhp: number;
}
export interface OwnerBillingWorkspace { links: BillingLink[]; bills: TenantBill[]; gateway: BillingGateway }
export interface RenterBillingWorkspace {
  invitations: { id: string; propertyName: string; unitLabel: string; ownerName: string }[];
  bills: TenantBill[]; gateway: BillingGateway;
}
export const pesos = (n: number) => n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
export const todayManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export async function billingRequest<T>(path: string, input?: object, method = 'POST', signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: input ? method : 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    ...(input ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Billing request failed. Please retry.');
  return data;
}
