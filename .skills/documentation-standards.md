# Documentation Standards

## Description
Defines how documentation should be structured, maintained, and reviewed so the project stays usable for future work. Documentation should help a reader orient themselves, follow setup steps, understand architecture, and find the current source of truth without needing tribal knowledge.

## Workflow
1. Start from the canonical docs already in the repository.
2. Update the document that matches the change instead of creating duplicate guidance.
3. Verify that instructions, paths, and commands match the current codebase.
4. Keep the wording direct and easy to follow.
5. Review docs whenever behavior, setup, or architecture changes.
6. Make sure the language is consistent with project requirements and implementation guides.

## Rules
- Keep docs aligned with implementation.
- Use a single source of truth for setup, architecture, requirements, and deployment.
- Prefer short sections with direct instructions.
- Include prerequisites, steps, and validation where relevant.
- Replace stale current instructions instead of stacking contradictory updates. Preserve dated findings as clearly labelled history with their original context and evidence.
- Keep recurring memory summaries compact; link canonical evidence/turn records instead of repeating full handoffs. Read historical notes only when relevant to the task.
- Remove stale placeholders instead of leaving them behind.
- Write in a way that a contributor can act on immediately.
- Keep terminology consistent across technical and business documents.

## Project Conventions
- The `docs/` directory is canonical for project-level guidance.
- Update setup and implementation docs when the stack or flow changes.
- Keep terminology consistent across all markdown files.
- Role instructions must link their Required skills and apply the shared [skill-loading contract](../.agents/execution-contract.md#skill-loading-contract). Keep task method details in the owning skill, role ownership/handoffs in `.agents`, and product contracts in canonical docs.
- For curriculum or training changes, preserve source references and distinguish document validation, behavioral trial evidence, and business approval.
