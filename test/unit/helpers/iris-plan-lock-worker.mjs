#!/usr/bin/env node
/**
 * Worker for the plan-lock concurrency test — a separate OS process that
 * loads an existing plan and appends one task to it, the same
 * load->mutate->save shape every real mutator in lib/iris/plans.mjs uses.
 * Run several of these against the same plan id at once (see
 * test/unit/iris-plans-lock.test.mjs) to prove withPlanLock actually
 * prevents a genuine cross-process read-modify-write race, which an
 * in-process test cannot exercise (Node never yields mid-synchronous-call).
 *
 * argv: <planId> <taskLabel>
 * Relies on IRIS_STATE_DIR being set in the environment (inherited
 * from the parent test process) so it operates on the same plan store.
 */
import { resetPaths } from "../../../lib/runtime/paths.mjs";
import { addIrisPlanTask } from "../../../lib/iris/plans.mjs";

const [, , planId, taskLabel] = process.argv;

resetPaths();
addIrisPlanTask(planId, {
  id: `${planId}-${taskLabel}`,
  title: `Task ${taskLabel}`,
  instructions: `Added by worker ${taskLabel}`,
});
