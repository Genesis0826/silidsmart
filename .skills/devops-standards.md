# DevOps Standards

## Description
Defines delivery and operational standards for the project. Use this file for CI/CD, deployment consistency, rollback strategy, environment handling, and observability. DevOps guidance should make the system easier to release and easier to recover, not just more automated. Environments should be predictable and repeatable across local, testing, and production setups.

## Workflow
1. Confirm the build, test, and deploy path for the component being changed.
2. Automate the repeatable parts of delivery.
3. Add rollback or recovery steps for risky changes.
4. Verify environment configuration and secrets handling.
5. Check that monitoring and logging will surface production issues.
6. Keep local setup and run instructions in sync with the delivery path.

## Rules
- Keep deployments repeatable and documented.
- Do not rely on manual steps that cannot be reproduced.
- Treat secrets as environment-managed values, not source code.
- Make quality checks fail the pipeline before deploy.
- Add observability for systems that need support or incident response.
- Keep rollback practical and fast enough to use.
- Prefer environment parity where it reduces surprises between local and deployed behavior.
- Keep the delivery process simple enough to maintain and explain clearly.

## Project Conventions
- Use GitHub Actions for continuous integration and automation where configured.
- Align deployment notes with `docs/DEPLOYMENT.md`.
- Keep environment-specific logic out of application code when possible.
