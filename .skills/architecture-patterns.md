# Architecture Patterns

## Description
Defines the architecture patterns that best fit the project. Use these patterns to keep the frontend, service layer, and data layer understandable and maintainable. The patterns here are meant to reduce confusion and dependency sprawl, not to introduce ceremony. The architectural design should ensure that client applications, services, and data persistence operate cohesively as one system.

## Workflow
1. Identify the concern you are solving: layering, service boundaries, data flow, or deployment simplicity.
2. Choose the smallest pattern that solves the problem.
3. Check the pattern against the existing repo docs and implementation.
4. Document the tradeoff so future work stays consistent.
5. Revisit the pattern only when the system actually outgrows it.
6. Make sure the pattern is clearly documented in project architecture guides.

## Rules
- Prefer layered separation between UI, API, service, and data concerns.
- Keep service boundaries explicit when logic is split across components.
- Use structured data contracts and reporting views for analytics and operational data.
- Avoid introducing heavy architectural patterns unless there is a clear problem to solve.
- Favor simple, documentable dependencies over clever composition.
- If a pattern makes debugging harder, it probably is not the right fit for this repo.
- The architecture should support the operational and decision-support goals of the project.

## System Architecture Fit
- Frontend: page and component structure with typed data access and localized state.
- Backend: API gateway / backend service layer for client requests, validation, session management, and business logic orchestration; heavy compute, AI pipelines, or model training run asynchronously or offline without blocking synchronous requests.
- Data: Structured data models and migrations with provenance, referential integrity, and publication gates; production database manages identity, application state, and audit logs. Required data failure remains an explicit unavailable state.
- Delivery: Environment-based deployment with repeatable build and release steps.

Choose platform or batch/streaming changes based on decision latency, workload, cost, ownership, and actual constraints, following [architecture](../docs/ARCHITECTURE.md) and [decisions](../docs/DECISIONS.md).
