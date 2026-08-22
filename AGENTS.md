# MAPF-RL Frontend Instructions

## Responsibility

- This repository owns the React and TypeScript operator interface: map visualization, robot state, task control, events, and scenario execution.
- Communicate only with versioned Core REST and WebSocket APIs. Never access Redis or PostgreSQL directly.
- Treat the frontend as an operator client, not the authority for robot state, order transitions, collision decisions, or safety enforcement.

## Engineering rules

- Keep transport and schema adaptation at the API boundary. Use typed domain/view models inside the UI and validate untrusted server payloads where tooling permits.
- Centralize REST base paths, WebSocket lifecycle, authentication, retries, and error normalization rather than duplicating them across components.
- Reconnection must tolerate duplicate, delayed, and out-of-order messages. Reconcile snapshots and events using stable IDs and versions instead of arrival order alone.
- Represent loading, empty, stale, disconnected, partial-data, permission, and failure states explicitly.
- Require confirmation for destructive operator actions such as order cancellation when the product flow calls for it, and prevent duplicate submissions.
- Keep map rendering and high-frequency telemetry updates bounded. Avoid rerendering the full map for one robot update; measure before adding optimization complexity.
- Preserve coordinate-system and unit conversions in named, tested utilities. Do not scatter pixel/world conversions through components.
- Make safety-relevant alerts perceivable without color alone and keep core operator flows keyboard accessible.

## UI and product behavior

- Prioritize current robot state, active orders, collision/deadlock warnings, connectivity, and recovery actions in the visual hierarchy.
- Separate server-confirmed state from optimistic UI state and label stale data clearly.
- Do not hide critical errors in transient notifications only; keep actionable incidents inspectable.
- Use existing design tokens and component patterns once established. Avoid introducing a new UI library for a local change without approval.

## Testing and validation

- Test API adapters, reducers/state transitions, coordinate conversions, reconnection behavior, and critical operator workflows.
- Include duplicate events, stale `orderUpdateId`, connection loss, partial snapshots, and large robot counts in relevant tests.
- Discover package manager and commands from the lockfile and `package.json`; do not switch package managers or invent scripts.
- Run available type checking, linting, focused tests, and production build after relevant changes. For visible changes, inspect the rendered UI at representative viewport sizes.
- Until the application is scaffolded, document which checks are unavailable instead of claiming success.

## Commit workflow

- Before staging a React or TypeScript change, run the configured formatter in check mode. Once Prettier is configured, use `prettier . --check`; use `prettier . --write` to apply formatting, then re-run the check. Also run the configured ESLint command when practical.
- Check the changes before proposing a commit, and split unrelated changes into separate commits.
- Run relevant validation when practical, beginning with the narrowest checks.
- Propose the exact files and commit message to the user, then obtain confirmation before committing.
- Commit only the files explicitly approved by the user.

Use this subject format:

```text
type(scope): concise English summary
```

Use this body format, with a Korean translation of the subject and English and Korean details:

```text
- type(scope): 간결한 영어 요약.
- English detail 1.
- Korean detail 2.
```

## Code review rules

- Flag direct database access, duplicated protocol types, and business rules that disagree with Core.
- Flag WebSocket logic that assumes exactly-once or ordered delivery.
- Flag critical status or actions that are inaccessible, ambiguous, or visible only by color.

## Recommended Codex profile

- Default: `Gemini 3.7 Flash` with `Medium` reasoning.
- Use `high` for real-time state architecture, complex map interactions, performance work, or broad UI redesigns.
