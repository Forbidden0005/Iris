/**
 * act-text-fallback: deterministic parser for local models (e.g. qwen2.5-coder
 * via Ollama's OpenAI-compat endpoint) that narrate a tool call as plain text
 * instead of populating the API's structured `tool_calls` field.
 *
 * Root cause this works around: L3_SYSTEM_PROMPT teaches a THINK -> ACT ->
 * OBSERVE narrative ("**ACT** (one or more tool calls)"). Frontier models
 * (Claude/GPT/Gemini) still use native function-calling regardless of that
 * framing, but weaker/smaller local models pattern-match the "ACT" header
 * and just write out what they'd call, e.g.:
 *   ACT: grep_search(query="test", type="js")
 *   I'll call `read_file` with {"file_path": "package.json"}
 *   ```json
 *   {"tool": "read_file", "params": {"file_path": "package.json"}}
 *   ```
 * With no real tool_calls, the loop never executes a tool and the run fails.
 * This module tries a few narrow, deterministic patterns to recover a single
 * tool call from that text. It only matches a tool name from the caller's
 * known tool list — never invents one — so it can't misfire into an
 * unrelated tool.
 */

export interface ParsedToolCall {
  tool: string;
  params: Record<string, unknown>;
}

/** Parse a `key="value"`/`key=123`/`key=true` argument list from inside call parens. */
function parseCallArgs(argsStr: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const argRe = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null)/g;
  let m: RegExpExecArray | null;
  while ((m = argRe.exec(argsStr)) !== null) {
    const key = m[1];
    let raw = m[2];
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      raw = raw.slice(1, -1);
      params[key] = raw.replace(/\\(.)/g, '$1');
    } else if (raw === 'true') {
      params[key] = true;
    } else if (raw === 'false') {
      params[key] = false;
    } else if (raw === 'null') {
      params[key] = null;
    } else {
      params[key] = Number(raw);
    }
  }
  return params;
}

/** Match `tool_name(arg="x", other=1)` where tool_name is a known tool. */
function matchFunctionCallSyntax(text: string, toolNames: Set<string>): ParsedToolCall | null {
  const callRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^()]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(text)) !== null) {
    const name = m[1];
    if (toolNames.has(name)) {
      return { tool: name, params: parseCallArgs(m[2]) };
    }
  }
  return null;
}

/** Match a fenced ```json ... ``` block shaped like a tool call. */
function matchFencedJsonToolCall(text: string, toolNames: Set<string>): ParsedToolCall | null {
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const parsed = tryParseToolCallJson(m[1], toolNames);
    if (parsed) return parsed;
  }
  return null;
}

/** Match a bare (unfenced) JSON object shaped like a tool call, e.g. after "with". */
function matchInlineJsonToolCall(text: string, toolNames: Set<string>): ParsedToolCall | null {
  const braceStart = text.indexOf('{');
  if (braceStart === -1) return null;
  // Try each top-level-looking `{...}` substring starting from every `{`.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          const parsed = tryParseToolCallJson(candidate, toolNames);
          if (parsed) return parsed;
          break;
        }
      }
    }
  }
  return null;
}

function tryParseToolCallJson(jsonText: string, toolNames: Set<string>): ParsedToolCall | null {
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText.trim());
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  // {"tool": "name", "params": {...}}
  if (typeof o.tool === 'string' && toolNames.has(o.tool)) {
    return { tool: o.tool, params: (o.params as Record<string, unknown>) || {} };
  }
  // {"name": "name", "arguments": {...}} (OpenAI function shape, as text)
  if (typeof o.name === 'string' && toolNames.has(o.name)) {
    const args = o.arguments;
    if (typeof args === 'string') {
      try { return { tool: o.name, params: JSON.parse(args) }; } catch { return { tool: o.name, params: {} }; }
    }
    return { tool: o.name, params: (args as Record<string, unknown>) || {} };
  }
  // {"function": {"name": "name", "arguments": {...}}}
  if (o.function && typeof o.function === 'object') {
    const fn = o.function as Record<string, unknown>;
    if (typeof fn.name === 'string' && toolNames.has(fn.name)) {
      const args = fn.arguments;
      if (typeof args === 'string') {
        try { return { tool: fn.name, params: JSON.parse(args) }; } catch { return { tool: fn.name, params: {} }; }
      }
      return { tool: fn.name, params: (args as Record<string, unknown>) || {} };
    }
  }
  return null;
}

/**
 * Try to recover exactly one tool call from plain-text model output.
 * Returns null if nothing matches confidently — callers should treat that
 * as "no tool call", not retry indefinitely.
 */
export function parseActTextFallback(text: string, availableToolNames: string[]): ParsedToolCall | null {
  if (!text || !text.trim() || availableToolNames.length === 0) return null;
  const toolNames = new Set(availableToolNames);

  return (
    matchFencedJsonToolCall(text, toolNames) ||
    matchFunctionCallSyntax(text, toolNames) ||
    matchInlineJsonToolCall(text, toolNames)
  );
}
