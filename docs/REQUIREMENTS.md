# Project Requirements & BMC Specification

## Overview
Defines the business requirements, Business Model Canvas (BMC) value propositions, user stories, pricing rules, and mandatory compliance disclaimers for **SilidSmart.ph**.

## Business Model Canvas (BMC) Alignment
SilidSmart is a **B2B2C rental management and room discovery platform** where small rental property owners (boarding houses, dormitories, and small apartments) manage rent and vacancies in a private workspace while renters compare available rooms and apartments for free.

### 1. Value Propositions
1. **Single-Entry Vacancy Sync**: Owners update occupancy once in their private operations table; public listings automatically display available rooms/units and stated monthly rent or hide occupied units immediately.
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
- Owners can manually record a completed short stay with a guest name, unit, check-in/out dates, rent subtotal, and reported source. They can mark an entry cancelled (zero fee) or restore it. Entries are private to the portfolio; guest and fee records never enter public responses.
- The ledger is not a booking engine. It does not reserve dates, prevent overlaps, set nightly listing prices, or change occupancy automatically. Owners update occupancy separately; viewing approval does not reserve a room.
- **No payment processing**: the prototype does not collect, deduct, remit, or verify rent, subscriptions, or commissions. Calculated commission is owner-reported and is not collected revenue. Agreements and payments happen outside the system. A real collection/reconciliation process and controls for inaccurate owner reports remain future work.
- Acceptance: 1–4 units returns a zero subscription; 5–10 returns PHP 99; existing higher boundaries remain. A free three-unit owner recording a PHP 1,500 SilidSmart stay receives a PHP 75 fee; cancelling sets it to zero. Owner isolation, guest/renter denial, and public privacy must hold.

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
