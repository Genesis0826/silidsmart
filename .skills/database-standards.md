# Database Standards

## Description
Defines database rules for the project's data models, persistence stores, and analytical views. Use it for schema design, versioned migrations, grain definition, join integrity, query performance, and access control. [Database responsibilities](../docs/DATABASE.md), [architecture](../docs/ARCHITECTURE.md) and [decisions](../docs/DECISIONS.md) control store boundaries and publication rules.

## Workflow
1. Identify the store, data owner, and current schema/views before making structural changes.
2. Design the schema change with application workflows and API consumers in mind.
3. Prepare the change through the store's documented migration process and update dependent contracts.
4. Check keys, indexes, and query patterns for performance impact.
5. Document the operational effect of the change.
6. Confirm the data model supports required queries, metrics, and business logic.

## Rules
- Make schema changes through versioned, reversible migrations.
- Preserve referential integrity and data clarity.
- Choose store-appropriate performance controls from known query patterns; add indexes only when justified by query needs.
- Keep operational tables and reporting views aligned with current requirements.
- Review row-level security or access policy implications when data exposure changes.
- Do not make direct ad hoc schema edits that bypass migration tracking.
- Prefer designs that are easy to reason about when debugging a report or data load.

## Grain, joins and evidence

Apply clear data-contract and lineage concepts before a consequential transformation:

- Declare source/version identity, grain, keys, uniqueness, units, time zones, and approval status.
- Specify join cardinality and unmatched-record treatment before execution. Ensure joins do not multiply measures through unexpected cartesian fan-out.
- Check expected counts and reconcile relevant pre/post-join measures over equivalent eligible populations. A passing uniqueness test alone does not prove measure preservation.
- Distinguish retry duplicates from legitimate repeated source records; content equality alone does not justify discarding transactions.
- Preserve source evidence, missing observations, and provenance through downstream contracts.
- Use [analytics frameworks](analytics-frameworks.md) for metric eligibility and calculations. Required data source failure produces an explicit unavailable state rather than silent placeholder data.

## Project Conventions
- Follow [database guidance](../docs/DATABASE.md) and [implementation notes](../docs/IMPLEMENTATION.md).
- Keep entity relationships, dimensions, and facts explicit.
- Seed data and local fixtures are for development and testing; do not rely on them as production fallbacks.
