/**
 * Turn a raw error (network failure, missing local model, timeout, tool
 * failure, ...) into an actionable message for the terminal. The goal is
 * that a failure never just prints a bare "fetch failed" or "ECONNREFUSED"
 * — it should tell the person what almost certainly went wrong and what to
 * run next, since the default path for this loop is a local Ollama model.
 */

export interface FriendlyFailure {
  /** Short machine-readable category, useful for tests/telemetry. */
  kind:
    | 'ollama-unreachable'
    | 'model-missing'
    | 'timeout'
    | 'tool-failure'
    | 'unknown';
  /** One-line summary of what failed. */
  summary: string;
  /** Actionable next step(s) for the person running the CLI. */
  hint: string;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? '');
}

/**
 * Classify a raw error string/Error into a FriendlyFailure. Pure function,
 * no I/O, so it's trivial to unit test against the real error shapes each
 * failure mode produces (fetch's ECONNREFUSED, Ollama's 404 model-not-found
 * body, AbortSignal.timeout()'s "The operation was aborted").
 */
export function classifyFailure(error: unknown): FriendlyFailure {
  const message = messageOf(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('econnrefused') ||
    lower.includes('fetch failed') ||
    (lower.includes('11434') && (lower.includes('refused') || lower.includes('connect')))
  ) {
    return {
      kind: 'ollama-unreachable',
      summary: 'Could not reach the local Ollama server on http://localhost:11434.',
      hint: 'Start Ollama with `ollama serve` (or open the Ollama app), then retry. ' +
        'See docs/RUNNING-LOCALLY.md for setup.',
    };
  }

  if (
    lower.includes('model not found') ||
    lower.includes('model') && lower.includes('not found') ||
    (lower.includes('404') && lower.includes('model'))
  ) {
    const modelMatch = message.match(/model ["']?([\w.:/-]+)["']?/i);
    const model = modelMatch ? modelMatch[1] : '<model>';
    return {
      kind: 'model-missing',
      summary: `The model "${model}" is not pulled locally.`,
      hint: `Run \`ollama pull ${model}\` to download it, then retry. ` +
        'See docs/RUNNING-LOCALLY.md for recommended models.',
    };
  }

  if (
    lower.includes('the operation was aborted') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('aborterror')
  ) {
    return {
      kind: 'timeout',
      summary: 'The request to the model timed out before it finished generating.',
      hint: 'Local models can be slow on constrained hardware. Try a smaller/faster model, ' +
        'reduce the task size, or retry after Ollama has warmed the model.',
    };
  }

  if (
    lower.includes('command not found') ||
    lower.includes('permission denied') ||
    lower.includes('enoent')
  ) {
    return {
      kind: 'tool-failure',
      summary: 'A tool call (shell command or file operation) failed.',
      hint: `Details: ${message}. Check that the command/binary is installed and the path exists.`,
    };
  }

  return {
    kind: 'unknown',
    summary: message || 'Unknown error',
    hint: 'Run `iris doctor` to check your local setup (Node, Ollama, config, gateway).',
  };
}

/**
 * Format a FriendlyFailure as a single string suitable for evidence.error /
 * console output. Unknown failures are left as the original message
 * unchanged (no speculative hint appended) since we have nothing specific
 * to suggest; recognized failure modes get "<summary> <hint>".
 */
export function formatFriendlyFailure(error: unknown): string {
  const failure = classifyFailure(error);
  if (failure.kind === 'unknown') return failure.summary;
  return `${failure.summary} ${failure.hint}`;
}
