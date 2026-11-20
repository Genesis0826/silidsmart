# Commission pilot and payment preparation

## Current contract

The November 20 business-paper review and the user's subsequent request replace unit-based subscription pricing with **free listing and core owner management at all portfolio sizes**. These are proposed online fees, not live collection:

| Future payment | Proposed owner-paid platform commission |
| --- | --- |
| Monthly accommodation rent paid through SilidSmart checkout | 3% |
| SilidSmart short stay of 1–29 nights paid through checkout | 5% |
| Utilities, deposits, taxes and other charges | 0% |
| Cash or external transfer recorded manually | 0% |

Existing tenants could participate only after a tenant billing/authorization flow is implemented. No subscription, nightly booking engine, tenant checkout or automatic deduction exists. The user confirmed they do not yet have PayMongo sandbox credentials or approved Platforms access and asked to prepare the integration and show its limits.

## Built in this update

- Free management policy in registration, owner access, backend summaries and administration. Legacy `subscription` response names remain for client compatibility, with fee zero and the new policy metadata.
- Private Monthly Bill Board joins existing monthly rent and Electricity/Water/Wi-Fi records by unit and calendar month. The board labels missing entries Not recorded, and paid entries Paid (manual). It never assumes that an occupied unit paid rent or that an unrecorded bill is zero/paid. English month labels and ISO month keys reconcile without multiplying bills. Amounts aggregate in centavos.
- Migration 006 preserves existing bills while adding Wi-Fi to the allowed types. Existing roles and portfolio checks apply to all new utility writes.
- Owner-only `GET /api/owner/payment-readiness` and `POST /api/owner/payment-quotes`. Quotes validate currency and 1–29-night eligibility and return hypothetical fees with `chargedPhp: 0`; they never create a bill, stay, statement, payment or revenue.
- A server-only PayMongo Hosted Checkout v2 sandbox adapter with test-key-only validation, integer-centavo payloads, a fixed provider endpoint, timeout and rejection of live-mode or invalid-host replies. It is tested with an injected provider response, not a real PayMongo account.

## Integration boundaries and activation gates

The adapter is **not exposed through a checkout endpoint**. Even detecting a valid-looking test key does not enable payments. `checkoutEnabled` remains false. There are no live transfers or verified provider receipts.

Before wiring a tenant checkout, obtain provider-approved owner onboarding/split routing and a confirmed pricing agreement. Implement authenticated tenant-to-bill access; immutable bill/payment snapshots and idempotency; raw-body signature verification; amount/currency/account/session matching; replay handling; provider reconciliation; failed, cancelled and refunded outcomes; and actual sandbox acceptance. A browser return URL alone must never mark a record Paid online.

The backend reads `PAYMONGO_SECRET_KEY` from the process environment; `.env.example` is a blank configuration reference and is not automatically loaded. Use a local ignored environment file only after access is granted. Never place secrets in React/Vite configuration, request logs, screenshots, source control or chat. Live keys are rejected by the prepared adapter. Do not call the adapter for actual rent until the platform routing and authorization gates are met.

Provider-confirmed conditional holds, release on contract signing, leases and refunds are future work. There is **no 48-hour refund guarantee**. A signature or owner confirmation does not establish property authenticity or safety. Weekly vacancy check-ins, 14-day listing expiry, bedspaces, submeter calculations, tenant bills, automated reminders and paid featured placement are not implemented.

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
