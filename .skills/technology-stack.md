# Technology Stack Standards

## Description
This file summarizes standard technology stack conventions. Use it to keep implementation choices aligned across frontend, backend, database, deployment, and observability work. Read [architecture](../docs/ARCHITECTURE.md) and [decisions](../docs/DECISIONS.md) for authoritative boundaries, [setup](../docs/SETUP.md) for environment requirements, and [current state](../docs/CURRENT_STATE.md) for dated milestone and acceptance evidence. Check package manifests before introducing new dependencies.

## Canonical Stack Patterns

### Frontend
- Modern React / Next.js with TypeScript
- Responsive layout with CSS variables or established utility frameworks
- Component-driven architecture with clean separation of presentation and data fetching

### Backend & API Gateway
- Typed API service layer (e.g., Express / TypeScript or Fastify)
- Authentication and session validation, request sanitization, and structured error responses
- Background compute, batch processing, or machine learning pipelines run asynchronously or offline

### Database & Persistence
- Primary relational or document database as the system of record
- Schema evolution controlled strictly via versioned, reversible migrations
- Seed data and test fixtures reserved for local development and automated testing

### Authentication & Authorization
- Robust session or token-based authentication (e.g., JWT, OAuth, or managed auth providers)
- Role-Based Access Control (RBAC) enforced at service boundaries
- Server secrets strictly kept in environment configuration; never exposed to client bundles

### Validation & Contracts
- Validate external inputs at the API boundary using typed schemas
- Consistent error formatting with standard HTTP status codes

### State Management
- Prefer component-local state first; introduce shared state stores only when state spans multiple independent views

### Data Visualization
- Standard charting and visualization libraries (e.g., Chart.js, Recharts, or SVG renderers)
- Keep visualizations responsive and accessible with clear legends and tooltips

### Deployment & CI/CD
- GitHub Actions for automated linting, testing, and continuous integration
- Containerized workflows (Docker) and environment parity across staging and production

### Monitoring & Observability
- Health check endpoints (`/health` or `/api/health`)
- Structured logging without leaking credentials or sensitive user data
- Error reporting and performance monitoring

### Service Split
- Maintain clear boundaries between client UI, API services, database storage, and background processing
- Fail visibly when a required service or data source is unavailable; do not replace it with silent fake fallbacks
- Keep server secrets and credentials isolated from browser code

## Workflow
1. Check project docs before introducing a new library or dependency.
2. Follow [architecture](../docs/ARCHITECTURE.md), [decisions](../docs/DECISIONS.md), [setup](../docs/SETUP.md), and [implementation](../docs/IMPLEMENTATION.md) for affected boundaries.
3. Reuse existing packages and patterns before adding new dependencies.
4. Confirm that any new stack choice supports maintainability and performance requirements.
5. Update documentation when the stack or delivery model changes.

## Rules
- Do not introduce a new foundational framework without a documented reason.
- Keep frontend, backend, and data responsibilities separated.
- Prefer the simplest stack that satisfies project requirements.
- Do not let convenience choices in one layer leak into other layers.
- Treat canonical docs as authoritative when they conflict with a default assumption.
- Default to the patterns already established in this repository unless the change genuinely requires something else.
