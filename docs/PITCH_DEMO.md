# Saturday pitch walkthrough

For November 21, 2026. Present SilidSmart as a concept prototype with example accounts, rentals, prices, and approximate map locations.

1. Start the backend with `npm start` in `backend/`, and the frontend with `npm run dev` in `frontend/`. Open the local URL printed by Vite. Keep both terminals running during the pitch.
2. Start as a guest. Point out the clean navigation and free rental discovery. **Around UST** shows six sample vacancies; **Quezon City** shows three examples in Diliman, Cubao, and Katipunan.
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

“Our proposed model keeps renter browsing and inquiries free. Owners have no monthly fee for one to four units; five to ten costs ₱99, eleven to twenty-five ₱199, and twenty-six to fifty ₱349. A separate 5% owner-paid fee is calculated on owner-reported completed SilidSmart short stays. The prototype does not collect or verify rent, subscriptions, utilities or commissions.”

If asked: proposed tiers are 1–4 units Free, 5–10 at ₱99/month, 11–25 at ₱199/month, 26–50 at ₱349/month, and a custom quote above 50. All plans calculate a separate 5% owner-paid fee on owner-reported completed SilidSmart-sourced short stays. Owners can demonstrate the private Short Stays & Commission ledger; it does not reserve dates or collect payments. Pricing is a proposal to validate, not demonstrated willingness to pay or collected revenue.

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
