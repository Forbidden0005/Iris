/**
 * Chat → Plan bridge.
 *
 * Deterministic, regex-based detection for "this message is asking Iris to
 * coordinate multi-step work," in the same style as
 * lib/crew-lead/intent.mjs's parseServiceIntent. No LLM call, no dispatch,
 * no RT bus involvement — this module only decides whether a plan record
 * should exist and creates it via the existing lib/iris/plans.mjs API.
 *
 * Wired into lib/crew-lead/chat-handler.mjs, which calls
 * createDraftPlanFromChatRequest on every incoming chat message inside a
 * try/catch (a failure here must never break chat — see that call site's
 * own comment). See docs/IRIS_CAPABILITY_MAP.md for the product-level
 * design this implements.
 */
import { createIrisPlan } from "./plans.mjs";

// Intentionally simple and over-inclusive rather than clever: false
// positives just produce an extra draft plan (cheap, inert, inspectable,
// deletable), while false negatives silently lose the point of this
// slice. Tune by adding patterns, not by trying to be precise up front.
const COORDINATION_PATTERNS = [
  /\bbuild (?:me |us )?a (?:team|crew)\b/i,
  /\bcoordinate\b/i,
  /\bassign (?:this|these|the|it) (?:to|across|out)\b/i,
  /\bdispatch (?:agents?|a team|the crew)\b/i,
  /\bplan (?:the|this|out)\b/i,
  /\binvestigate (?:this|and report|the)\b/i,
  /\bwork with (?:the )?(?:crew|team|agents)\b/i,
  /\bspawn (?:agents?|a team)\b/i,
];

/**
 * Deterministic heuristic — not NLP, not an LLM call. Returns true when the
 * message looks like a request for Iris to coordinate multi-step work
 * rather than answer a single question or make small talk.
 */
export function looksLikeCoordinationRequest(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return COORDINATION_PATTERNS.some((pattern) => pattern.test(t));
}

/**
 * Creates a draft Iris plan from a chat message, if (and only if) it looks
 * like a coordination request — unless options.force is true.
 *
 * Always creates status: "draft", never anything further along, matching
 * every other plan-creation path in this codebase. Returns null (does not
 * create a plan) when the text is empty or doesn't match, so a caller can
 * safely call this on every chat message without spamming plans.
 *
 * @param {string} text - the raw chat message
 * @param {object} [options]
 * @param {string} [options.projectId]
 * @param {string} [options.requestedBy]
 * @param {boolean} [options.force] - skip the heuristic and always create
 * @param {number} [options.now] - injectable clock for tests
 * @returns {object|null} the created plan, or null if none was created
 */
export function createDraftPlanFromChatRequest(text, options = {}) {
  const userRequest = String(text || "").trim();
  if (!userRequest) return null;

  const detected = looksLikeCoordinationRequest(userRequest);
  if (!options.force && !detected) return null;

  return createIrisPlan(
    {
      userRequest,
      projectId: options.projectId,
      requestedBy: options.requestedBy,
      status: "draft",
      metadata: { source: "chat", detected },
    },
    options,
  );
}
