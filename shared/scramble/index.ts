/**
 * Scramble generation system — public API.
 *
 * Usage:
 *   import { generateScramble, hasGenerator, isAsyncScrambleType } from 'shared/scramble';
 *   const scramble = generateScramble('pyrso');
 *
 * All generator modules are imported here (side-effect: they register themselves).
 * Import order doesn't matter — each module calls registerGenerator() at module scope.
 */

// Re-export public API
export { generateScramble, hasGenerator, getRegisteredTypes, initScramblers, registerGenerator } from './registry';
export { isAsyncScrambleType } from './types';
export type { ScrambleGenerator, ScrambleWorkerRequest, ScrambleWorkerResponse } from './types';

// Import generator modules — each registers itself via registerGenerator()
// Hafif solver'lar
import './generators/scramble-pyraminx';
import './generators/scramble-skewb';
import './generators/scramble-333lse';
import './generators/scramble-222';

// Random-move generator'lar
import './generators/megascramble';
import './generators/utilscramble';

// Agir solver'lar
import './generators/scramble-333';
import './generators/scramble-444';
import './generators/scramble-sq1';
import './generators/scramble-megaminx';
