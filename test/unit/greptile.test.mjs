/**
 * Unit tests for lib/integrations/greptile.mjs
 *
 * Covers: export presence, searchRepositories alias
 *
 * All exported functions hit the Greptile API, so we only verify
 * exports exist and the alias is correct. No network calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  indexRepository,
  getRepositoryStatus,
  queryRepositories,
  searchRepositories,
  indexiris,
  searchiris,
} from "../../lib/integrations/greptile.mjs";

describe("greptile – exports", () => {
  it("indexRepository is a function", () => {
    assert.ok(typeof indexRepository === "function");
  });

  it("getRepositoryStatus is a function", () => {
    assert.ok(typeof getRepositoryStatus === "function");
  });

  it("queryRepositories is a function", () => {
    assert.ok(typeof queryRepositories === "function");
  });

  it("indexiris is a function", () => {
    assert.ok(typeof indexiris === "function");
  });

  it("searchiris is a function", () => {
    assert.ok(typeof searchiris === "function");
  });
});

describe("greptile – searchRepositories alias", () => {
  it("searchRepositories is the same function as queryRepositories", () => {
    assert.strictEqual(searchRepositories, queryRepositories);
  });
});
