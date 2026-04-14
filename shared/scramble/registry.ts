/**
 * Scramble generator registry.
 * Type-safe replacement for cstimer's scrMgr.reg() pattern.
 */

import { ScrambleGenerator } from './types';

const generators = new Map<string, ScrambleGenerator>();
let initialized = false;

/**
 * Register a scramble generator for one or more type IDs.
 */
export function registerGenerator(typeId: string | string[], gen: ScrambleGenerator): void {
	if (Array.isArray(typeId)) {
		for (const id of typeId) {
			generators.set(id, gen);
		}
	} else {
		generators.set(typeId, gen);
	}
}

/**
 * Generate a scramble for the given type ID.
 * Returns the scramble string, or empty string if no generator is registered.
 */
export function generateScramble(typeId: string, length?: number, state?: number): string {
	const gen = generators.get(typeId);
	if (!gen) {
		console.warn(`[scramble] No generator registered for type: ${typeId}`);
		return '';
	}
	return gen(typeId, length, state);
}

/**
 * Check if a generator is registered for a given type ID.
 */
export function hasGenerator(typeId: string): boolean {
	return generators.has(typeId);
}

/**
 * Get all registered type IDs.
 */
export function getRegisteredTypes(): string[] {
	return Array.from(generators.keys());
}

/**
 * Initialize all scramblers. Called once at startup.
 * On server: synchronous, called in app.ts after Prisma connect.
 * On client: called when scramble worker starts.
 *
 * Heavy solvers (min2phase, 444, megaminx) build pruning tables here.
 * This is idempotent — calling multiple times is safe.
 */
export function initScramblers(): void {
	if (initialized) return;
	// Each generator module's import side-effect registers itself.
	// Heavy solvers init their pruning tables lazily on first use.
	initialized = true;
}
