# Saturday pitch walkthrough

**Current version:** free management and proposed online commissions supersede the earlier subscription/manual-remittance model. Use the working occupancy flow and Monthly Bill Board. Checkout, contracts, payouts and refund guarantees remain future work; the source paper’s payment demo is not runnable. See [payment pilot](PAYMENT_PILOT.md).


For November 21, 2026. Present SilidSmart as a concept prototype with example accounts, rentals, prices, and approximate map locations.

## Five seeded pitch examples

The opt-in pitch profile adds **five separately rentable units under a dedicated fictional owner**. Existing portfolios are preserved. This separate dataset supports predictable rehearsal; ordinary startup does not reset its progress.

From `D:\Techno\silidsmart\backend`, run `npm run seed:pitch` once, then refresh the app. Sign in through the normal email form using **`pitch.owner@example.test` / `password123`** (initial sample password). The owner appears as **Pitch Demo Owner (Example)** with **5 units and free management with no subscription**. It is not Maria's portfolio or a real customer.

| Sample unit | Demo action | Expected result |
| --- | --- | --- |
| PITCH 01 - Vacancy Demo | Find it publicly, then owner marks it Occupied | Reloaded Available now excludes it; All published units retains its occupied label. |
| PITCH 02 - Occupied Demo | Open it in All published units | Occupied/unavailable status and an expected date are public. Tenant and financial records stay private. The date is an owner estimate. |
| PITCH 03 - Rent and Utilities | Open Monthly Bill Board, then Utility Tracker if needed | PHP 7,000 rent Due, PHP 1,200 electricity Due, PHP 300 water Paid (manual). Wi-Fi is supported; missing bills stay Not recorded. No money is processed. |
| PITCH 04 - Short Stay Demo | Show Short Stay Records; use Business Model for new quotes | Earlier fee examples are illustrative. Preview PHP 4,000 proposed online short-stay rent as PHP 200, or cash as zero, with chargedPhp zero. |
| PITCH 05 - Commission Demo | Open Legacy Commission Records read-only | The older fictional PHP 500 report is preserved for traceability, not a new-model online payment or payout. Do not simulate staff verification in the current UI. |

**Dates and amounts:** The seed uses the previous completed checkout month (October 2026 for this meeting) and current utility month (November 2026). Its statement includes all four sample stays and a clearly labelled sample transfer report. Issuing has already locked that checkout month; show existing calculations rather than attempting to cancel a locked entry. Listing cards show monthly rent; private short-stay rows store total accommodation rent for a stay. These are different measures.

**Rehearsal recovery:** Run `npm run seed:pitch` again to preserve progress. To deliberately restore only the dedicated pitch fixtures, use `npm run seed:pitch -- --restore`. The command backs up the database before writing, preserves other owners and existing account passwords, and refuses restoration if unexpected extra properties/units are attached to the pitch owner. Local `backend/data/pitch-demo-manifest.json` records dates/status/IDs and backup location. Avoid the administrator's global Reset example data for routine rehearsal: it resets all sample portfolios and removes this opt-in profile. If global reset was intentionally used, rerun `seed:pitch` to recreate the profile.

**Server already running:** If port 4000 is occupied by the healthy SilidSmart backend, use `http://127.0.0.1:5173/`. Seeding does not require a second server. Refresh after preparation.

### Suggested five-member speaking order

Keep the existing eight-slide order and target 5:40 including clicks/handoffs for the requested five-to-six-minute version. Use the updated external SilidSmart Presentation Speaking Script. Its approximately 660 spoken words and slide timing cues supersede the older 6:40 run-card schedule. These are rehearsal targets, not measured timings.

1. **Member 1, 0:00–1:25:** Cover, problem/customers and value. State that accounts, properties and locations are examples.
2. **Member 2, 1:25–2:45:** Use PITCH 01 throughout Find/Update/Check, including All published units with its occupied label. Briefly show the prepared PITCH 03 utility records. Narrate while another member operates the screen; avoid role switches or new bill entry.
3. **Member 3, 2:45–3:50:** Free management for all owners. Proposed future in-app rent fees: 3% monthly / 5% eligible short stays, 0% utilities and cash/external transfers. Show an illustrative quote and unavailable checkout. Owner routing/provider acceptance remain prerequisites.
4. **Member 4, 3:50–5:00:** Market and proposed position. Start locally. Use slide 7's Buildium, Nutiliti and Travelnest Direct examples to acknowledge existing capabilities; local preference and adoption are unvalidated.
5. **Member 5, 5:00–5:40:** Viability, limits and next pilot. Keep PITCH 04/05 commission records ready for questions instead of extending the main demo.

If the group has a different number of speakers, combine adjacent parts without changing the logic. Rehearse from the projected slides, then restore only the pitch fixtures for the final starting state. Sample staff review is not real payment-provider verification or actual revenue.

## Base dataset walkthrough

The steps below use the original Maria/Juan examples. Use the separate Pitch Demo Owner above for the five-unit rehearsal.

1. Start the backend with `npm start` in `backend/`, and the frontend with `npm run dev` in `frontend/`. Open the local URL printed by Vite. Keep both terminals running during the pitch.
2. Start as a guest. Point out the clean navigation and free rental discovery. The base dataset has six UST and three QC vacancies; the opt-in pitch profile initially adds three UST vacancies. Counts change during rehearsal. QC examples are in Diliman, Cubao, and Katipunan.
3. Select a map price, then a room or apartment in the popup. Show rent, deposit, amenities, and house rules. Change a search filter to demonstrate matching map and list results.
4. Choose **Sign in → Juan Dela Cruz** to preview the renter. Only renter navigation appears. Explain that viewing requests belong to the signed-in renter.
5. Sign out using the account menu. Choose **Sign in → Maria Santos** to preview the landlord. **My properties** shows only Maria's portfolio, including vacancy controls and private tenant/rent views.
6. Optionally preview **Platform Review Lead** after signing out. **Administration** contains ID review and listing moderation. Example-data reset is only in the admin account menu.

The role shortcuts are intentionally available for the pitch. They are example personas, not real customer accounts. Signing out is the way to preview another role.

Load the maps before presenting and check the venue's connection: street tiles and property photos come from external services. The prototype shows a map error if tiles fail while keeping rental details available.

## Suggested five-minute pitch

### 1. Problem — 40 seconds

“Imagine finding a room online, only to discover that it is already occupied. A renter has to start searching again, while the landlord may still be answering questions about an outdated post. SilidSmart explores how rental discovery and a landlord's vacancy records can work together.”

Use this as an illustrative scenario, not a claim that interviews or market research have already proven the problem.

### 2. Solution — 35 seconds

“SilidSmart helps renters browse rooms and apartments while giving small landlords a workspace to manage their units. Our main feature connects the two: when a landlord changes a room's availability, the public directory reflects that change.”

### 3. Demonstration — two minutes

- Show the UST map, then switch to Quezon City. Explain that these are example scopes with sample rentals and approximate map pins.
- Open a price marker and rental details. Point out monthly rent, deposit, amenities, and house rules.
- Sign in as Maria Santos. Show **My properties**, the vacancy controls, and the private tenant/rent views. Explain that each role has its own workspace.
- Mark one of Maria's published vacant rooms occupied, then use **Find a rental → Available now** to show it excluded after reload. Switch to **All published units** to show the same unit labelled Occupied — unavailable now. Optional owner estimates are not guarantees and do not change status. Use the same room throughout; its building marker may remain for other units.
- Optional Q&A: show **Directory settings** to hide/publish a unit and set an occupied unit's expected availability. Show **Utility Tracker** to record an electricity/water bill and manually mark it Paid with date/reference. These are private records, not payment collection or verification.

“The owner updates availability once, and that same record controls what renters can find.”

Avoid spending the presentation opening every tab. Keep admin moderation as an optional short example or a panel-question response.

### 4. Business model — 40 seconds

“Listing and core owner management are free. Our proposed future in-app fees are 3% on monthly accommodation rent and 5% on SilidSmart short stays of 1–29 nights. Utilities, deposits and cash/external transfers have no commission. Today, Business Model only previews these amounts and charges nothing; provider account setup, owner routing and verified payments remain prerequisites.”

## Optional bill board and fee preview demonstration

1. Open Monthly Bill Board and choose the sample month. For PITCH 03, show rent PHP 7,000 Due, Electricity PHP 1,200 Due and Water PHP 300 Paid (manual). Missing Wi-Fi is Not recorded; add a manual Wi-Fi bill in Utility Tracker only if needed for a longer Q&A.
2. Open Business Model. Preview PHP 4,500 monthly online rent: PHP 135 proposed fee. Preview PHP 4,000 short-stay rent for three nights: PHP 200. Switch to cash/external transfer: zero. Actual charged amount remains zero in every case.
3. Show that checkout is unavailable and sandbox credentials are not configured. The adapter is prepared server-side; it does not demonstrate an approved provider account, automatic splits or payouts.
4. Legacy Commission Records is read-only history of the earlier model. Do not issue statements, report new transfers or simulate staff settlement in the current app. Historical snapshots are not new-model revenue.

**Utility explanation:** Electricity, Water and Wi-Fi are private owner records. The combined owner board is built; tenant checkout, recurring bills/reminders, submeter allocation, signed contracts, booking holds, listing expiry and refund guarantees remain future work. See [payment pilot acceptance gates](PAYMENT_PILOT.md).

### 5. Prototype status and next step — 45 seconds

“What you are seeing is a working prototype using example accounts and rental data. It demonstrates the main workflow rather than a completed commercial service. Our proposed next step is to test it with renters and small landlords, learn whether it helps them, and refine the product and pricing from their feedback.”

“SilidSmart's goal is simple: help renters find available rooms while helping small landlords keep those rooms organized.”

## Likely panel questions

- **How is this useful alongside Facebook?** Facebook can remain a way to reach renters; SilidSmart provides a structured listing connected to the owner's vacancy records. Do not claim to have proven superiority or adoption.
- **Are these real listings?** These are sample properties and approximate locations used to demonstrate the workflow.
- **Does an ID badge guarantee safety?** No. It indicates an owner ID review; it does not certify property safety. Renters should still arrange an in-person viewing.
- **Do you process rent payments?** The prototype records payment status. Online payment processing is outside the current demonstration.
- **What has been validated?** The implemented workflows have technical checks. Customer demand, pricing, and business outcomes still need user research or a pilot.

For rehearsal, prepare a short screen recording or screenshots of the same flow as a backup, and practice on the actual presentation screen. Do not claim to have backup media until it has been created.
