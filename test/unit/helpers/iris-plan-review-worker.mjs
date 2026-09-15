#!/usr/bin/env node
/**
 * Worker for the review-generation lock test — a separate OS process that
 * generates a draft review for an existing plan. Run several of these
 * concurrently with iris-plan-lock-worker.mjs (which adds tasks) against
 * the same plan id to prove generateIrisPlanReview's read->derive->write
 * is covered by one lock acquisition, not just the final save — a
 * partially-locked version could read a task list, lose the lock, have
 * another process add a task, then write a review whose own record set
 * silently vanishes with the next save.
 *
 * argv: <planId> <label>
 * Relies on CREWSWARM_STATE_DIR being set in the environment.
 */
import { resetPaths } from "../../../lib/runtime/paths.mjs";
import { generateIrisPlanReview } from "../../../lib/iris/plans.mjs";

const [, , planId, label] = process.argv;

resetPaths();
generateIrisPlanReview(planId, { includePlanEvidence: true });
