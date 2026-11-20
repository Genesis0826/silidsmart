# Business & Metric Definitions

## Overview
Canonical repository of domain terms, metric formulas, and operational definitions.

## Key Definitions
- **Metric Specifications**: Every reported metric must state business intent, formula, numerator/denominator eligibility, unit, and rounding rules.
- **Population Eligibility**: Populations compared across periods must share identical filtering rules and eligibility standards.

## Owner revenue model and commission evidence — November 20, 2026

- **Subscription**: monthly proposed owner capacity price, counted across occupied/vacant separately rentable rooms or whole apartments/condos: 1–4 Free (zero also Free), 5–10 PHP 99, 11–25 PHP 199, 26–50 PHP 349, above 50 custom. All share core tools. Subscriptions are separate from commissions; no subscription charging is implemented.
- **Eligible short stay**: an owner-entered short-stay row with `source = SilidSmart` and `status = Completed`. Long-term monthly-rent records, utilities, cancelled stays and other-source stays do not enter commission calculations. Accommodation rent excludes deposits, taxes and utilities/other charges. No agreed duration cutoff or independent source/completion verification exists.
- **Fee formula**: per eligible stay, `round(rent_total_centavos × 5 / 100)` in centavos. Statement fee is the sum of rounded line fees, not 5% rounded once on aggregated rent. Eligible rent is the sum of the same population's accommodation rent. Zero rows/eligible rent yields zero calculated fee, while missing owner reports remain unknown activity.
- **Monthly period**: ISO checkout-date calendar month; current month cannot be issued. Manila calendar determines closure and overdue status. Closed month due date is the 10th of next month. Snapshot version is immutable; void versions are excluded from outstanding amounts. Submitted/rejected reports do not reduce outstanding; one staff-Verified exact remittance clears it. These calculations are prototype records, not independently confirmed revenue or profitability.
- **Collection flows**: tenant/guest pays rent and utilities to owner outside SilidSmart. Owner remits platform commission separately each month outside SilidSmart, then reports the transfer. Staff reconciles actual receipt manually. Monthly subscriptions remain a separate proposed charge; the commission statement excludes them. No payment gateway or live destination account is configured.

### Why 5% is a defensible pilot proposal

The rate is benchmark-informed, not an empirically established optimum. [Travelnest Direct's official help](https://help.travelnest.com/direct-bookings) states a 5% fee including payment processing, with applicable VAT separate. [Landfolk host terms, section 12](https://landfolk.com/en/s/host/terms) state a 5% host fee subject to VAT and a separate guest fee usually 20% (range 10–25%). Their service bundles, fee bases, markets and total charges differ from SilidSmart; do not claim equivalent services, that 5% is their total cost, or that SilidSmart is proven cheaper. These examples demonstrate that a 5% component exists in rental-platform pricing, not that local owners accept it.

Our proposed rationale is an outcome-linked fee for completed short stays sourced through the directory, intended to help fund discovery and related service/support. Validate the actual acquisition, hosting/storage, maintenance, support and manual collection costs and owner acceptance before claiming sustainability. Database growth or a payment processor's percentage cannot establish an exact 5% commission. Existing subscription tools and incrementally sourced stays must have clearly explained value to avoid an unexplained combined charge.

[Booking.com General Delivery Terms, 2.3.8 and 2.4.1–2.4.2](https://admin.booking.com/hotelreg/terms-and-conditions.html) document departure-based monthly statements, monthly commission invoices and accommodation-to-platform payment, including bank transfer where applicable. This supports the monthly-remittance concept, not SilidSmart's rate or a claim that collection is enforceable. Sources checked November 20, 2026.

### Utility and recipient clarification

Payment can go to an owner or authorized property manager, according to the property's confirmed instructions. [UHome's official FAQ](https://uhome.com.ph/faq/) supports management handling collections; do not equate that with absence of unit owners or one combined payment. Individual resident experience is stakeholder context, not universal policy. [Buildium's Nutiliti integration](https://marketplace.buildium.com/details/nutiliti/) is an existing utility-billing example for managers/residents, so utility tracking cannot be claimed as unique. Current SilidSmart bills are owner-only Electricity/Water records. Tenant bill access, consolidated totals, Internet bills and displaying owner payment details/QR are proposed additions, not current features. Actual usage charges may be unknown before renting; payment instructions or a QR alone do not verify receipt. No raw private messages or participant identities are retained as evidence.
