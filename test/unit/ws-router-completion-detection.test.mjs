import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectAskedQuestion,
  detectReturnedPlan,
  detectBailedOut,
  isFinalCompletionReply,
} from "../../lib/iris-lead/ws-router.mjs";

describe("ws-router completion detection (Iris evidence bridge gating)", () => {
  it("treats a real completion reply as final", () => {
    assert.equal(
      isFinalCompletionReply("Fixed the bug and wrote tests. Done."),
      true,
    );
  });

  it("does not treat a clarifying question as final", () => {
    const content = "Should I proceed with deleting the old config file?";
    assert.equal(detectAskedQuestion(content), true);
    assert.equal(isFinalCompletionReply(content), false);
  });

  it("does not treat a bailout as final", () => {
    const content = "I'm sorry, but I was unable to complete this task due to a context limit.";
    assert.equal(detectBailedOut(content), true);
    assert.equal(isFinalCompletionReply(content), false);
  });

  const longPlanReply =
    "Here's the implementation plan:\n\n## Overview\nThis is a long design description that outlines the approach at a high level, without touching any source files yet, well past three hundred characters in total so it trips the length gate used by the plan detector in ws-router.mjs before any file changes are proposed.";

  it("does not treat a coder agent's plan-only reply as final", () => {
    assert.ok(longPlanReply.length > 300);
    assert.equal(detectReturnedPlan(longPlanReply), true);
    assert.equal(isFinalCompletionReply(longPlanReply, { isCoderAgent: true }), false);
  });

  it("a non-coder agent's long plan-shaped reply is still final (plan-retry only applies to coder agents)", () => {
    assert.equal(isFinalCompletionReply(longPlanReply, { isCoderAgent: false }), true);
  });

  it("a question that also did work is not treated as a mere question", () => {
    const content = "I wrote the file and fixed the bug. Would you like me to also add tests?";
    assert.equal(detectAskedQuestion(content), false);
  });
});
