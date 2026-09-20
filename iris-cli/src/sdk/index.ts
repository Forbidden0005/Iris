/**
 * Iris CLI SDK
 * 
 * Programmatic API for iris-cli. Use this to embed iris-cli in your own applications.
 * 
 * @example
 * ```typescript
 * import { CrewClient } from '@iris/cli/sdk';
 * 
 * const client = new CrewClient({
 *   onProgress: (event) => console.log(`[${event.type}]`, event),
 * });
 * 
 * // First run
 * const state1 = await client.run({
 *   task: 'Create a calculator class',
 * });
 * 
 * console.log('Files created:', state1.filePaths);
 * 
 * // Continue conversation
 * const state2 = await client.run({
 *   task: 'Add unit tests',
 *   previousRun: state1,  // Session continuity
 * });
 * 
 * console.log('Test files:', state2.filePaths);
 * ```
 */

export { CrewClient } from './client.js';
export type {
  CrewClientOptions,
  RunOptions,
  RunState,
  ProgressEvent
} from './client.js';
