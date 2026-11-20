# Project Requirements & BMC Specification

## Overview
Defines the business requirements, Business Model Canvas (BMC) value propositions, user stories, pricing rules, and mandatory compliance disclaimers for **SilidSmart.ph**.

## Business Model Canvas (BMC) Alignment
SilidSmart is a **B2B2C rental management and room discovery platform** where small rental property owners (boarding houses, dormitories, and small apartments) manage rent and vacancies in a private workspace while renters compare available rooms and apartments for free.

### 1. Value Propositions
1. **Single-Entry Vacancy Sync**: Owners update occupancy once in their private operations table. Available now results exclude occupied units; All published units can retain occupied listings with a clear unavailable label and an optional owner estimate. Publication is a separate owner choice.
2. **Side-by-Side Renter Comparison**: Renters compare stated monthly rent (`₱`), house rules, included amenities, district location, and owner identity check status side-by-side (`up to 3 units`).
3. **Zero Renter Commission**: Owner plans include basic tenant/rent records and public directory listings; renters browse and inquire **100% free (`₱0` fee)**.

### 2. Revenue Streams & Subscription Counting Rule
- **Standard Counting Rule**: `1 room or 1 apartment = 1 count`.
- **Mandatory Pricing Disclaimer**: `"The monthly fee depends on the total rooms or apartment units managed"`.
- **Owner Monthly Subscription Tiers**:
  - **Free**: `1–4 rooms or units` -> **`₱0 / month`** (an empty portfolio also has no monthly charge)
  - **Tier 1 (Starter)**: `5–10 rooms or units` -> **`₱99 / month`**
  - **Tier 2 (Growth)**: `11–25 rooms or units` -> **`₱199 / month`**
  - **Tier 3 (Scale)**: `26–50 rooms or units` -> **`₱349 / month`**
  - **Enterprise Dorm**: `>50 rooms or units` -> **`Custom Quote`**

### Short stays and payment boundary — November 20, 2026

- Monthly plans depend on all managed units, including occupied and vacant inventory. All plans share core owner tools; paid tiers increase unit capacity. These remain proposed prices, not evidence of paying customers.
- User-selected short-stay commission: **5% of the total accommodation rent** on completed stays sourced through a SilidSmart inquiry/referral, payable by the owner on every plan, including Free. This is separate from any monthly subscription. Monthly rent, other-source stays, and cancelled stays have no commission.
- Commission excludes refundable deposits, taxes, and other charges. Use centavos and round the fee to the nearest centavo. Example: PHP 1,500 rent produces PHP 75 calculated commission.
- Owners can manually record a completed short stay with a guest name, unit, check-in/out dates, rent subtotal, and reported source. Future checkout dates are rejected. An optional inquiry link must belong to the same unit and SilidSmart source; it supports traceability without proving completion or rent. Owners can cancel/restore entries until the checkout month has an issued statement. Guest and financial records never enter public responses.
- The ledger is not a booking engine. It does not reserve dates, prevent overlaps, set nightly listing prices, or change occupancy automatically. Owners update occupancy separately; viewing approval does not reserve a room.
- **No online payment processing**: rent, utilities and subscriptions remain external/manual. Commission is remitted separately by the owner outside SilidSmart; the app records reports and manual staff review under the workflow below. No checkout, automatic deduction, bank/provider verification, payouts or live collections are configured. Calculated fees and sample staff-reviewed reports are not evidence of business revenue.
- Acceptance: 1–4 units returns a zero subscription; 5–10 returns PHP 99; existing higher boundaries remain. A free three-unit owner recording a PHP 1,500 SilidSmart stay receives a PHP 75 fee; cancelling sets it to zero. Owner isolation, guest/renter denial, and public privacy must hold.

### Monthly commission statements and remittance review — November 20, 2026

- **Purpose**: Guests pay rent directly to owners; owners settle only their platform commission monthly. Commission applies to short stays only. Long-term rent and utilities have zero commission; subscriptions remain separate and are not added to commission statements.
- Owners issue a statement for a completed checkout calendar month (January 2000 onward). The current month remains a running preview. Issue is explicit, not an automatic scheduled invoice or message. Philippine date boundaries determine month closure/overdue status; due date is the 10th of the next month.
- Snapshot all recorded stays in the month with their source/status, optional inquiry, unit/property labels, rent and fee. Only Completed + SilidSmart contributes eligible rent/commission. Sum fees rounded per stay to centavos. An empty/ineligible month has zero fee and cannot receive remittance reports. Missing reports do not prove there were no stays.
- Preserve one active issued statement per owner/month. Retries return the same snapshot. Freeze additions and status changes in its checkout month until an administrator voids an unpaid statement with a reason. Preserve voided snapshots and issue the next numbered version after correction. Pending or verified remittances prevent voiding; staff must first return an unmatched pending report. Verified statements stay locked; post-settlement credits/refunds remain outside scope.
- Owner reports one external Bank transfer or GCash remittance for the exact statement amount, payment date no later than today, and reference (1–120 characters). Partial payments, combining statements and receipt uploads are outside scope. Prevent reuse of normalized method/reference across pending/verified reports. No collection destination is configured; use sample reports for the demo.
- Submitted reports remain outstanding and Under review. Only an administrator may verify actual funds received, with a receipt date on/after the reported payment date and no later than today, an explicit confirmation and a review note. Staff may instead return the report for correction with a note. Preserve attempt history; owners may resubmit after rejection. Store reviewer/time. These are staff assertions, not payment-provider confirmation.
- Acceptance: PHP 10,000 eligible rent yields PHP 500 fee; an issued October statement is due November 10. Other/cancelled stays do not contribute, checkout-month attribution and per-line rounding reconcile, repeated issue does not duplicate amounts, pending reports do not settle balances, valid staff verification clears the balance, and correction history survives. Deny wrong-role/cross-owner writes and exclude statements/references from public payloads/client state after sign-out.
- **Classification limit**: Long-term rentals use the monthly rent ledger; the short-stay ledger is an explicit owner choice. A maximum short-stay duration has not been agreed, so the prototype does not automatically classify by number of nights. Viewing requests remain inquiries; independent stay/source verification is unfinished.

### Directory visibility and manual utilities — November 20, 2026

- Public discovery defaults to **Available now**: only published vacant units. **All published units** also includes published occupied units, labelled **Occupied — unavailable now** on cards, map links and details. Hidden units stay hidden in both modes. Inquiry submission remains limited to published vacant units.
- Owner **Directory settings** controls publication and an optional public `expectedAvailableFrom` date for occupied units. This is an owner estimate, separate from private tenant/contract information. No date automatically changes occupancy or guarantees vacancy. Marking Vacant clears the estimate and preserves the publication choice; occupancy changes never restore a hidden listing.
- No migration automatically publishes a hidden unit or infers a date from tenant notes. Existing explicit publication flags are preserved.
- The private **Utility Tracker** records Electricity/Water per unit and billing month, positive amount in PHP (centavo precision), due date and a manual Paid/Due/Overdue status. Paid requires a valid payment date and supports a reference up to 120 characters; unpaid records have no payment date/reference. Records are owner reports, not verified receipts. Utility amounts are excluded from the 5% accommodation-rent commission.
- One bill per unit/type/month prevents accidental duplicates. Owners can correct amount, due date and payment fields; identity fields remain fixed. Filters cover month and status. Only the unit's owner may read/write these bills; renters, other owners and public payloads receive none. No utility-provider integration or payment processing is introduced.
- Acceptance: publishing an occupied unit displays its status/date only in All, blocks viewing inquiries, and leaks no tenant or financial records. Hiding removes it from both modes. A past estimate leaves occupancy unchanged. An owner can add a bill, mark it Paid with a date/reference, correct it, reload it and filter it; duplicate/invalid or unauthorized writes fail without changing existing records.

### 3. Channels & Outreach
- Searchable mobile web directory (`CustomerView`).
- Facebook and community groups (auto-generated vacancy post copy in `OwnerView`).
- Owner referrals and printable property QR posters (`OwnerView` QR Poster generator).

### 4. Mandatory Platform Disclaimers
1. **Prototype Notice**: `"Concept prototype - sample properties only"`
2. **Freshness Stamp**: `"Availability last updated by owner: [date]"`
3. **Trust Badge & Safety Disclaimer**: `"Owner ID reviewed"` followed by `"This does not certify property safety"`
4. **Tier Pricing Basis**: `"The monthly fee depends on the total rooms or apartment units managed"`

## Pitch scope confirmed November 18, 2026

This is a demonstration prototype for Saturday, November 21. Retain clear example-data labeling beside maps and in the footer while removing the notice strip from the navigation. Present UST/Sampaloc and Quezon City as example search scopes containing sample rentals/apartments with approximate pins. Only show the signed-in user's workspace navigation; keep example role selection in the sign-in dialog for presenting the pitch. Production deployment and a complete live rental service are outside this request.
