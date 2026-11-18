# Backend Standards

## Description
Defines backend expectations for the API gateway and supporting backend services. Use these rules for request handling, validation, logging, service boundaries, and performance-sensitive changes. The backend should stay predictable: receive input, validate it, process it in the correct layer, and return a response that is consistent enough for client applications and downstream consumers to rely on.

## Workflow
1. Confirm the API contract and data source before changing backend code.
2. Implement the smallest service-level change that satisfies the requirement.
3. Add validation, error handling, and logging at the boundary.
4. Verify the request path against security and performance requirements.
5. Update tests and docs for any contract or behavior change.
6. Confirm the response satisfies downstream consumer needs.

## Rules
- Keep route handlers thin and move business logic into services where possible.
- Return consistent JSON structures and meaningful HTTP status codes.
- Validate all external input before processing.
- Log enough detail to diagnose issues without exposing secrets or sensitive personal data.
- Use timeouts, circuit breakers, and defensive handling for downstream dependencies.
- Keep service interfaces stable unless the change is documented and intentional.
- Prefer explicit control flow over clever abstractions that make debugging harder.
- Keep backend behavior aligned with the database schema and application requirements.

## Project Conventions
- Align with the API structure described in `docs/SETUP.md` and `docs/API.md`.
- Prefer explicit, readable control flow over clever abstractions.
- Keep dependency boundaries clear between routing, service layer, and data persistence.
- Client responses use approved data contracts from the system of record. When a required source fails, return an explicit error instead of silent placeholder fallbacks.
- Heavy computations, external synchronizations, or AI model jobs run asynchronously or offline without blocking user requests or exposing internal credentials.
- For consequential metric or aggregation changes, apply [analytics frameworks](analytics-frameworks.md) and affected [business definitions](../docs/BUSINESS_DEFINITIONS.md); validate the same eligible populations, units, scope and source identity used by consumers.
- Use [architecture](../docs/ARCHITECTURE.md) and [API](../docs/API.md) for current contracts.
