# Security Standards

## Description
Defines security expectations across authentication, authorization, secrets, data handling, and secure coding. Security work should always be tied to an actual trust boundary or data sensitivity concern; if there is no meaningful risk, do not invent one. Implementation must demonstrate professional handling of sensitive data, access controls, and environment secrets.

## Workflow
1. Identify the trust boundaries and sensitive data involved in the change.
2. Review the authentication and authorization path.
3. Check input validation, output handling, logging, and secret storage.
4. Rank issues by risk and propose a fix that fits the existing architecture.
5. Verify that the remediation does not introduce new security regressions.
6. Make sure security documentation and threat models remain up to date.

## Rules
- Apply least privilege to every access path.
- Validate and sanitize all input at the service boundary.
- Never store secrets or sensitive personal data in code, repository documents, or application logs.
- Review data exposure, especially where authenticated access or row-level security is involved.
- Keep security controls visible in implementation and deployment paths.
- Prefer practical remediations that can be shipped and maintained cleanly.
- Make the threat model explicit when a recommendation depends on platform or infrastructure assumptions.
- Consider both accidental exposure and intentional misuse when reviewing controls.

## Project Conventions
- Use the security guidance in `docs/SECURITY.md` as the local reference point.
- Treat authentication, backend endpoints, and database access as linked risks.
- Record security assumptions when code relies on external platform or identity controls.
