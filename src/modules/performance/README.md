# Performance Review module (Sprint 018)

The evaluation / quality-measurement capability for AI Employees, expressed in the
AI Employee metaphor. Internal words (eval / rubric / test case / grader) never
leave this module. A **Growth+** feature (gated by the plan's `performanceReview`
flag), enforced server-side.

## Layout

- `types.ts` — Scorecard, Criterion, ReviewCase, ReviewRun, ReviewResult,
  CriterionScore, PerformancePoint. Every id is organization-scoped.
- `scoring.ts` — **pure**, provider-agnostic grading. Deterministic methods
  (`contains` / `exact` / `regex` / `no_refusal`) grade with **zero model calls**;
  `reviewer` / `grounded` grade via the injected `Reviewer` port. A case passes
  only when every criterion passes; the score is the weight-normalized average.
- `runtime.ts` — adapts the Model Hub gateway to the `EmployeeRunner` (produces an
  Employee's output for a case, pinned to a DNA version) and `Reviewer` ports. The
  gateway enforces the org's access mode (managed → budget/mid + cost; BYOK →
  cost 0; never a frontier model in managed mode).
- `service.ts` — `PerformanceService`: an `OrgContext` on every method, permission
  checks first (`performance.view` / `performance.manage`), the Growth+ plan gate,
  audit events on scorecard create + run start/complete/fail, and a usage-cost
  event per model-graded criterion (Sprint 016 capture; BYOK → 0). No provider SDK.
- `actions.ts` — server actions (Zod-validated; org from the session).
- `index.ts` — public surface.

## Cost model

- **Deterministic grading is free** — it makes no model calls, so a
  deterministic-only scorecard records no grading cost.
- **Model-graded criteria** (reviewer / grounded) record a usage-cost event each
  (tokens, model, `cost_usd`, BYOK → 0). The Employee's own output is produced
  through the gateway, which records its cost as a `performance_review` usage
  event (non-billable — reviews never consume a customer's chat quota).

## Persistence

`PerformanceStore` (5 tables, migration `0017_performance.sql`) is implemented in
both the in-memory and PostgreSQL backends with identical behavior. Every table
leads with `organization_id`; child FKs are org-scoped so a child can never
reference another org's parent. Cross-org reads return not found.

## Permissions

- `performance.view` — all roles, own org.
- `performance.manage` — owner/admin/builder (viewer cannot start runs).
  Re-checked server-side.

## Not in this sprint

Scheduled/continuous reviews, regression alerting, side-by-side DNA comparison,
human-in-the-loop queues, and report export. Future work.
