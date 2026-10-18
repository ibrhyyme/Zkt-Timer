/**
 * Backend entry point for the smart/virtual cube solve breakdown.
 *
 * The implementation moved to shared/util/solve/solve_steps.ts so the app computes the same
 * breakdown on the device when a solve is timed without a connection. Server callers
 * (createSolve, bulkCreateSolves, the admin LL reindex, the method steps reindex job) keep
 * importing it from here.
 */

export { getSolveSteps, methodStepRowsFromSteps } from '../../../shared/util/solve/solve_steps';
