# SonarQube Check Skill

## Description
Provides guidance and a sample workflow for running SonarQube or SonarCloud analysis as part of the delivery process. The goal is to keep static analysis in the delivery path without pretending that it replaces code review or automated testing. It supports code quality decisions and prevents regressions.

## Workflow
1. Add or update `sonar-project.properties` in the repository root if SonarQube is used.
2. Add the GitHub Actions workflow that runs analysis on pull requests and pushes.
3. Configure the required repository secrets.
4. Review findings before release and fix new quality issues that matter.
5. Adapt the workflow so it matches the actual project stack and environment.
6. Use the results to track technical debt and maintainability.

## Rules
- Treat the workflow as a template until it matches the real build and deploy path.
- Use the analysis results to prevent regressions, not as a substitute for human code review.
- Keep secrets in repository settings, not in source files.
- Update the workflow when the stack or build system changes.
- Run the scan on the branches that matter to the project.
- Do not block the team on analysis noise that does not represent real risk.

## Prerequisites
- A SonarQube server or SonarCloud account.
- Repository secrets such as `SONAR_TOKEN` and either `SONAR_ORGANIZATION` or `SONAR_HOST_URL`, depending on the deployment model.

## Notes
- The sample workflow is intentionally a template.
- Replace the build and deploy commands to suit the actual project stack.
- For self-hosted SonarQube, set `SONAR_HOST_URL` to the server URL and keep project settings aligned.
