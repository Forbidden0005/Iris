/**
 * Unit tests for lib/engines/iris-cli.mjs
 *
 * Covers: initCrewCLI, isCrewCLIAvailable
 *
 * Skips: runCrewCLITask (requires iris-cli engine + LLM API keys)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  initCrewCLI,
  isCrewCLIAvailable,
} from "../../lib/engines/iris-cli.mjs";

describe("iris-cli-engine – initCrewCLI", () => {
  it("accepts a deps object without throwing", () => {
    assert.doesNotThrow(() => {
      initCrewCLI({ IRIS_RT_AGENT: "iris-test" });
    });
  });

  it("accepts an empty deps object", () => {
    assert.doesNotThrow(() => {
      initCrewCLI({});
    });
  });
});

describe("iris-cli-engine – isCrewCLIAvailable", () => {
  it("returns a boolean", async () => {
    const result = await isCrewCLIAvailable();
    assert.ok(typeof result === "boolean");
  });
});
