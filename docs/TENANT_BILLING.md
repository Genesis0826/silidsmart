# Tenant Billing and PayMongo sandbox

Implemented November 20, 2026. This contract updates the earlier preparation-only checkpoint. **Live rent collection is disabled.** No credentials or provider account acceptance were available; verification uses isolated fictional records and injected provider responses.

## Owner and renter workflow

1. The renter registers/signs in with a renter account. An approved viewing alone does not create billing access.
2. The owner confirms the actual tenancy in an occupied unit with an existing private tenant record. Open **My properties → Tenant Billing**, select that tenant and invite their exact registered email. This creates an in-app invitation; no email is sent.
3. The renter opens **My bills**, confirms this is their actual tenancy, and accepts. Declining grants no statement access. Email matching and mutual confirmation are prototype controls, not identity verification.
4. The owner refreshes billing access, selects the accepted account, month and due date, then selects recorded rent and Electricity/Water/Wi-Fi charges. Review the recipient and prior payments, confirm, and publish.
5. The renter sees only published statements addressed to their signed-in account: itemized charges, total, amounts already marked paid, outstanding amount and due date. Missing/unselected utilities are not assumed free or paid. Statements are not legal invoices or bank-verified receipts.
6. For actual money received outside the app, the owner may record receipt of the **full outstanding amount** with date and optional reference. This manually marks the included unpaid rent/utility records paid; cash/external payments have no platform commission. Partial payments are not supported.

Example: rent ₱7,000 + electricity ₱1,200 + water ₱300 = ₱8,500 recorded total. If water is already marked paid, the outstanding amount is ₱8,200. A test checkout includes only the ₱8,200 outstanding charges. An illustrative 3% accommodation commission is ₱210 on rent; utilities have zero commission, and no fee is actually deducted in sandbox.

## Statements and privacy

- Owners publish immutable, selected-charge snapshots; bills are not automatically generated or exposed from the whole unit ledger. Rent must match the current tenant name/unit/month. Utilities must match unit/month; the owner explicitly confirms they belong to this tenancy.
- One non-void statement per link/month; a charge included in an issued statement cannot be edited or reused while issued. Correct by voiding with a reason, editing source records, and publishing again. Voided history remains; voiding is not payment.
- Invitation, acceptance, publication, void and manual settlement are explicit actions. Due dates are owner-supplied; overdue display uses the Philippine date. There are no automated reminders, recurring debits or bill generation.
- Tenant removal does not transfer statements to a replacement occupant. The original recipient retains their issued history until the owner revokes access. Revocation preserves owner history. A moved-out tenant cannot receive new statements through the ended link.
- Public directory responses and guest state contain none of these links, statements, references or utility ledgers. Renter endpoints authorize the session account and owner endpoints authorize its portfolio. Logout revokes the session and unmounts private bill state. All API responses use no-store.
- An open/uncertain checkout prevents void, manual settlement and revocation to avoid conflicting payment actions. Resolve it with the provider first. A completed sandbox test may be voided because it moved no real money.

## Gateway configuration and limits

Default: the tenant sees **Checkout unavailable — setup required**. Bills work without any gateway credentials. The existing Business Model quote screen remains hypothetical and live checkout stays disabled.

The backend reads these process environment variables; `.env.example` is a reference and is not automatically loaded:

| Variable | Requirement |
| --- | --- |
| `PAYMONGO_BILLING_SANDBOX` | Exactly `true` to opt in to test checkout |
| `PAYMONGO_SECRET_KEY` | Server-only `sk_test_…` key; live keys rejected |
| `PAYMONGO_WEBHOOK_SECRET` | The registered test webhook's signing secret, at least 16 characters |
| `SILIDSMART_APP_ORIGIN` | Exact HTTPS origin or local HTTP localhost/127.0.0.1 origin, without a trailing slash/path |

Register a reachable HTTPS test endpoint at `POST /api/payments/paymongo/webhook`, subscribed to `checkout_session.payment.paid`. A localhost return URL is suitable for local browser testing but PayMongo cannot deliver a webhook to an unreachable localhost server. Restart the backend after environment changes. Do not put keys in chat, React/Vite configuration, screenshots, logs or source control.

The server creates Hosted Checkout v2 sessions with QR Ph, exact integer-centavo unpaid line items and a persisted idempotency key. The tenant cannot supply the amount or recipient. It returns only a validated PayMongo-hosted checkout URL. The success/cancel redirect opens My bills and never marks a payment complete.

Signed raw-body events use test-mode `te` HMAC-SHA256 over timestamp + period + original request bytes, timing-safe comparison and a five-minute timestamp window. Paid events must match the local reference/session, exact amount, PHP currency and successful provider payment state. Payment IDs are unique across test statements; event IDs are stored for idempotent replay handling. Different payloads reusing an event ID are rejected. Server-side retrieve/expire reconciliation is available to the same tenant; browser assertions do not settle anything.

An uncertain creation retries the same payload/key only within 23 hours of its first attempt. A creation interrupted for more than two minutes can retry with that key. Older uncertain attempts require operator/provider reconciliation; do not clear them or issue another payable bill by guessing. PayMongo keys expire after 24 hours. An expired checkout can be voided/reissued after provider confirmation. No automatic background reconciliation job exists.

**SandboxPaid is a separate test result.** It never changes actual rent, utility statuses, statement balance, revenue or owner payout. The UI retains the real amount due and labels the test clearly. There are no live keys, automatic 3%/5% deductions, owner split routing, payouts, fund holds, refunds or guarantees. Short-stay booking checkout is not implemented by the monthly statement feature. Enabling live payments requires a separately accepted provider/owner routing model, full reconciliation/refund behavior and real sandbox acceptance; changing the flag cannot enable live mode.

## API and persistence

| Method and route | Access / action |
| --- | --- |
| `GET /api/owner/tenant-billing` | Owner: own links, statements, gateway readiness |
| `POST /api/owner/tenant-links` | Owner: `{tenantId,email,tenancyConfirmed:true}` |
| `PATCH /api/owner/tenant-links/:id` | Owner: `{action:"Revoke"}` |
| `POST /api/owner/tenant-bills` | Owner: `{linkId,billingMonth,dueDate,rentRecordId?,utilityRecordIds:[],chargesConfirmed:true}` |
| `PATCH /api/owner/tenant-bills/:id` | Owner: `{action:"Void",reason}` or `{action:"PaidExternal",fundsReceived:true,paymentDate,reference}` |
| `GET /api/tenant/billing` | Renter: own active-link statements, pending invitations, readiness |
| `PATCH /api/tenant/tenant-links/:id` | Renter: `{action:"Accept",tenancyConfirmed:true}` or `{action:"Decline"}` |
| `POST /api/tenant/bills/:id/checkout` | Renter: own outstanding statement, server-generated sandbox amount |
| `POST /api/tenant/bills/:id/reconcile` | Renter: own checkout; `{cancel:true}` requests confirmed expiration |
| `POST /api/payments/paymongo/webhook` | Provider: exact raw JSON bytes and valid test signature; no browser session |

JSON request bodies must be objects and at most 1 MB. Wrong role is 401/403; another account's statement is 404. Invalid charges/signatures are 400/401; conflicts 409; missing gateway setup 503; uncertain provider failures 502. No error returns credentials. Cross-origin browser writes remain denied by the existing server policy.

Migration **007_tenant_billing.sql** adds `tenant_billing_links`, `tenant_bills`, `tenant_bill_checkouts` and `tenant_billing_events`. Foreign keys/indexes enforce ownership references, one active tenant link, current link/month statement, single checkout per statement, and unique session/payment/event identities. Link tenant/unit foreign keys become null on deletion; statement recipient and snapshots remain intact. Global example reset and explicitly authorized pitch restore remove child billing records before fixture inventory. Do not use resets as a payment recovery tool. Back up before migration; rollback requires preserving/exporting statement and test audit history before reversing the schema.

Official provider references checked November 20, 2026: [Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start), [retrieve session](https://docs.paymongo.com/reference/get_checkout_sessions), [expire session](https://docs.paymongo.com/reference/create_checkout_sessions_id_expire), [idempotency](https://docs.paymongo.com/reference/idempotent-requests), [webhook setup/signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), [event structures](https://docs.paymongo.com/docs/developer-tools-webhooks-events). Provider-account tests remain pending; local fixtures are not evidence of a completed provider integration or funds received.
