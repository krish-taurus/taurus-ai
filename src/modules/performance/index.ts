/**
 * Performance Review (Sprint 018) — public module surface.
 *
 * Growth+ evaluation for AI Employees: build a Scorecard of weighted criteria,
 * add Review Cases, run a review against a pinned DNA version, and watch quality
 * climb across runs. Internal words (eval / rubric / test case / grader) never
 * leave this module.
 */

export {
  PerformanceService,
  PerformanceError,
  PerformancePermissionError,
  PerformanceNotFoundError,
  PerformanceLockedError,
  type OrgContext,
  type PerformanceRunPorts,
  type StartRunInput,
  type ReviewRunOutcome,
} from "@/modules/performance/service";

export {
  gradeCase,
  gradeCriterion,
  type Reviewer,
  type ReviewerInput,
  type ReviewerVerdict,
  type ReviewUsage,
  type GradedCase,
} from "@/modules/performance/scoring";

export {
  createGatewayEmployeeRunner,
  createGatewayReviewer,
  type EmployeeRunner,
  type EmployeeRunInput,
  type EmployeeRunResult,
  type PerformanceGateway,
} from "@/modules/performance/runtime";

export * from "@/modules/performance/types";
