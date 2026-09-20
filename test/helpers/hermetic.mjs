/**
 * Test helper for hermetic testing.
 * Sets IRIS_TEST_MODE=true to isolate tests from real ~/.iris state.
 * 
 * Usage:
 *   import { setupHermeticTest } from "../../test/helpers/hermetic.mjs";
 *   
 *   before(() => setupHermeticTest());
 */

import { randomBytes } from "crypto";

/**
 * Enable hermetic test mode.
 * This redirects all iris config/state paths to temporary directories.
 * Call this in your test's before() hook BEFORE any imports that use paths.
 * 
 * NOTE: This must be called at the top level before importing modules that use paths.
 */
export function setupHermeticTest() {
  process.env.IRIS_TEST_MODE = "true";
}

/**
 * Disable hermetic test mode.
 * Call this in your test's after() hook if you need to restore normal behavior.
 */
export function teardownHermeticTest() {
  delete process.env.IRIS_TEST_MODE;
}

/**
 * Generate a unique test session ID.
 * Useful for tests that need isolated session data.
 */
export function generateTestSessionId(prefix = "test") {
  return `${prefix}-${process.pid}-${randomBytes(4).toString("hex")}`;
}
