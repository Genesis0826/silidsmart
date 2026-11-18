# Frontend Standards

## Description
Defines the frontend rules and best practices. The project uses modern web standards (e.g. React/Next.js/TypeScript), focusing on responsive UI, clear component boundaries, accessible interactions, and predictable data handling. The frontend should feel like a polished, responsive tool. It needs to help a user scan information quickly, perform actions, and move through common tasks without friction.

## Workflow
1. Review the page goal, user flow, and data needs before building UI.
2. Break the screen into reusable components and keep presentation separate from data access.
3. Implement loading, empty, and error states as part of the feature, not as an afterthought.
4. Map the screen to the relevant application data and user intent.
5. Verify responsive behavior and text fit on common viewport sizes.
6. Check the result for consistency with the rest of the project and with the documented stack.
7. Confirm that the interface provides clear visual feedback and accessibility.

## Rules
- Use reusable components for repeated UI patterns.
- Keep props and data shapes strictly typed.
- Prefer local component state before introducing shared state management.
- Keep API calls and business logic out of presentation components when practical.
- Make layouts responsive and readable on mobile, tablet, and desktop viewports.
- Avoid unnecessary visual complexity in dashboards and operational tools.
- Ensure every interactive control has a clear purpose and accessible behavior (labels, keyboard navigation, focus indicators).
- Use CSS variables and the existing design tokens before introducing new styling systems.
- Ensure important information is visible without requiring unnecessary clicks or hover interactions.
- Keep empty, loading, and error states intentional, graceful, and informative.
- Match interface density to the task: operational screens should be compact and scannable, not ornamental.

## Project Conventions
- Follow the frontend structure described in `docs/SETUP.md` and `docs/IMPLEMENTATION.md`.
- Keep components focused on one clear responsibility.
- Use named types or interfaces for component data contracts.
- Keep charts, tables, filters, and cards visually consistent.
- Update supporting documentation when frontend behavior changes.
- For analytical or reporting views, apply [analytics frameworks](analytics-frameworks.md) to labels, scope/coverage, and claim wording.
- When an external or analytical source fails, display an explicit unavailable/error state rather than rendering fabricated or silent fallback values; follow [architecture](../docs/ARCHITECTURE.md).
