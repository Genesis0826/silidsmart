# Senior Enterprise UX/UI & Anti-AI Product Design Rules

This document codifies strict **Anti-AI / Anti-Vibe-Coded UI Design Principles** extracted from industry product design critiques. Every frontend implementation must dismantle the statistical "AI Design Fingerprint" and exhibit intentional, human-crafted architectural restraint.

---

## 1. The 7 "AI Slop" / Vibe-Coded Tells to Eliminate Immediately

1. **No Default Font Stacks (`Inter` / `Roboto` / `Arial` Alone)**:
   - Never ship uncalibrated system font defaults or generic `title="frontend"` boilerplate.
   - Pair a purposeful architectural sans-serif (`Plus Jakarta Sans`, `Public Sans`, or `Geist`) with a calibrated tabular monospace (`JetBrains Mono` or `IBM Plex Mono`) for prices (`₱3,500`), timestamps (`2026-11-07`), IDs, and numeric metrics (`font-variant-numeric: tabular-nums`).
2. **No "Colored-Edge Border Trick" (`border-top: 4px solid` / `border-left: 4px solid` on Every Card)**:
   - AI generators compulsively add thick colored top or left borders to cards to fake visual interest.
   - Use uniform `1px solid` structural hairlines (`#D8E0EA`) and rely on typography hierarchy and whitespace for emphasis. Reserve left accent bars strictly for active navigation indicators or nested quotation callouts.
3. **Kill the Card-Grid Monotony (No Rows of 4–6 Identical Floating KPI Boxes)**:
   - Do not build dashboards out of repetitive rows of identical floating white cards (`repeat(auto-fit, minmax(200px, 1fr))`) each holding a tiny label and a big number.
   - Instead, use a **Unified Architectural Ledger Strip** (a single bordered container divided by `1px` vertical hairlines) and let page titles and section intros sit directly on the background canvas without wrapping every heading in its own card box.
4. **No Sparkle Icons (`✨`), Floating Blobs, or Glassmorphism**:
   - Ban `<Sparkles />` icons, purple/indigo neon gradients, glowing box shadows, and `backdrop-filter: blur(...)` glassmorphism.
5. **No Badge Overload ("Over-Signaling")**:
   - Never stack 2–3 decorative pill badges above every section heading.
   - Reserve badges strictly for stateful domain data (`Vacant`, `Occupied`, `Paid`, `Due`, `Overdue`, `ID reviewed`).
6. **Proportional, Concentric Border Radii (No Bubbly Pill Overload)**:
   - Avoid indiscriminate `rounded-2xl` or `9999px` pill buttons everywhere.
   - Use crisp architectural radii (`4px` for buttons/inputs/badges, `6px` for outer cards/tables) so nested elements remain geometrically concentric.
7. **Domain-Specific Microcopy (Zero Generic SaaS Buzzwords)**:
   - Never write vague headlines ("Supercharge your workflow", "Seamless ecosystem"). Write concrete, operational copy tied to domain mechanics (`1 room or 1 apartment = 1 count`, `₱0 renter commission`, `Availability last updated by owner: [date]`).

---

## 2. Structural & Color Discipline (60-30-10 Rule)
- **60% Grounded Canvas**: Cool architectural paper (`#F2F6FA` or `#F4F6F8`) where page headers and structural text breathe directly without unnecessary card wrappers.
- **30% Structural Contrast**: Deep Prussian Navy (`#003580`), crisp slate text (`#111827`), and `1px solid` hairline table/ledger dividers (`#D8E0EA`).
- **10% High-Signal Interactive Accent**: Action Blue (`#006CE4`) for primary interactive triggers, Selective Yellow (`#FFB700`) strictly for primary search framing, and semantic green (`#008009`) for verified vacancy states.

---

## 3. Code & Accessibility Standards
- **Tabular Numerals**: All currency values (`₱`), unit counts, percentages, and dates must use `font-variant-numeric: tabular-nums` (or `.mono-num`) so columns align vertically.
- **Semantic HTML & Interactive States**: Use `<header>`, `<main>`, `<section>`, `<nav>`, `<aside>`, and `<footer>`, with explicit `:hover`, `:focus-visible`, and `:disabled` states.
