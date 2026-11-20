# Commission pilot and payment preparation

## Current contract

The November 20 business-paper review and the user's subsequent request replace unit-based subscription pricing with **free listing and core owner management at all portfolio sizes**. These are proposed online fees, not live collection:

| Future payment | Proposed owner-paid platform commission |
| --- | --- |
| Monthly accommodation rent paid through SilidSmart checkout | 3% |
| SilidSmart short stay of 1–29 nights paid through checkout | 5% |
| Utilities, deposits, taxes and other charges | 0% |
| Cash or external transfer recorded manually | 0% |

Existing tenants can now accept a private billing invitation and receive owner-published statements. A tenant-statement checkout endpoint is wired to sandbox only, with no real collection or automatic deduction. No subscription or nightly booking engine exists. The user confirmed they do not yet have PayMongo sandbox credentials or approved Platforms access and asked to prepare the integration and show its limits. See [Tenant Billing](TENANT_BILLING.md).

## Built in this update

- Free management policy in registration, owner access, backend summaries and administration. Legacy `subscription` response names remain for client compatibility, with fee zero and the new policy metadata.
- Private Monthly Bill Board joins existing monthly rent and Electricity/Water/Wi-Fi records by unit and calendar month. The board labels missing entries Not recorded, and paid entries Paid (manual). It never assumes that an occupied unit paid rent or that an unrecorded bill is zero/paid. English month labels and ISO month keys reconcile without multiplying bills. Amounts aggregate in centavos.
- Migration 006 preserves existing bills while adding Wi-Fi to the allowed types. Existing roles and portfolio checks apply to all new utility writes.
- Owner-only `GET /api/owner/payment-readiness` and `POST /api/owner/payment-quotes`. Quotes validate currency and 1–29-night eligibility and return hypothetical fees with `chargedPhp: 0`; they never create a bill, stay, statement, payment or revenue.
- A server-only PayMongo Hosted Checkout v2 sandbox adapter with test-key-only validation, integer-centavo payloads, a fixed provider endpoint, timeout and rejection of live-mode or invalid-host replies. It is tested with an injected provider response, not a real PayMongo account.
- Owner-confirmed/renter-accepted billing access, selected monthly rent/utility snapshots and an account-scoped My bills page. Owner publication is separate from viewing approval. Source locks, void history and manual full external receipt keep statement/ledger totals consistent.
- Sandbox checkout routes now use persisted idempotency, signed raw-body test webhooks, exact amount/currency/reference/session checks, event replay audit and retrieve/expire reconciliation. SandboxPaid is a separate test state; actual bills remain unpaid until a real external receipt is recorded manually. Migration 007 adds billing/access/test audit tables without repricing older records.

## Integration boundaries and activation gates

The adapter is exposed only through **authorized tenant-statement sandbox checkout**. A test key alone does not enable it: explicit sandbox enablement, a webhook secret and a safe return origin are also required. Default checkout remains disabled because access is absent; live checkout is always disabled. There are no live transfers or actual provider-verified receipts. Local fixtures are not provider acceptance.

Before live rent collection, obtain provider-approved owner onboarding/split routing, a confirmed pricing agreement, actual sandbox acceptance and complete live failed/refund/dispute/reconciliation operations. Current sandbox account authorization, snapshots, idempotency, signed events and retrieve/expire paths are implemented and tested locally; live behavior is not. A browser return URL alone never marks a record paid.

The backend reads gateway configuration from the process environment; `.env.example` is a blank reference and is not automatically loaded. Follow the [four sandbox requirements and webhook setup](TENANT_BILLING.md#gateway-configuration-and-limits). Never place secrets in React/Vite configuration, request logs, screenshots, source control or chat. Live keys are rejected. Do not route actual rent until live platform routing and acceptance gates are met.

Provider-confirmed conditional holds, release on contract signing, leases and refunds are future work. There is **no 48-hour refund guarantee**. A signature or owner confirmation does not establish property authenticity or safety. Weekly vacancy check-ins, 14-day listing expiry, bedspaces, submeter calculations, recurring bill generation, automated reminders and paid featured placement are not implemented. Private owner-published tenant statements are implemented.

## Earlier manual commission examples

Existing short-stay estimates, issued statements and remittance history remain unchanged for traceability. The UI labels them as earlier-model examples and presents statements read-only. The default HTTP server returns `409 LEGACY_COMMISSION_READ_ONLY` for statement/remittance mutations. Isolated historical regression tests can explicitly construct a server with `allowLegacyCommissionWrites: true`; normal startup never enables it. Internal fixture preparation can still create the clearly fictional legacy examples. Old snapshots are not recalculated as 3% online transactions and do not prove revenue.

## Financial evidence

The paper's 3% is a pricing hypothesis. Processing VAT, platform onboarding/splitting charges, deposit processing, refunds, disputes and operating costs must be budgeted. Current PayMongo published prices are VAT-exclusive and platform terms need a quote. Do not present PHP 39 contribution or 185 tenants as a verified break-even point.

An illustrative sensitivity using the paper's assumptions: PHP 4,500 rent produces PHP 135 gross commission; assumed 1.8% processing plus 12% VAT is PHP 90.72. Keeping the unconfirmed PHP 15 platform allocation gives PHP 29.28 before other costs; PHP 7,197 divided by that rounds up to 246 tenants. This is not a complete or confirmed forecast. Collecting PHP 4,500 rent and PHP 9,000 deposit at the same assumed rate costs PHP 243 before VAT while rent commission is PHP 135; deposit cost allocation must be resolved.

Official references checked November 20, 2026:

- https://www.paymongo.com/en/pricing
- https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start
- https://docs.paymongo.com/reference/create_checkout_sessions
- https://docs.paymongo.com/docs/fiaas-workflows-use-cases
- https://help.travelnest.com/direct-bookings

Travelnest Direct's published 5% includes processing, with applicable VAT separate, and does not establish equivalent service or an optimum local rate. The paper's NPC registration and BIR invoicing claims also require the full official rules, not simplified thresholds or outdated receipt terminology.
