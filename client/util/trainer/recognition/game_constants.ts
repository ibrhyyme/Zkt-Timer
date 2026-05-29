export const GameState = Object.freeze({
	Paused: 0,
	Playing: 1, // including "staring at my mistake"
	EvaluationDone: 2,
} as const);

export type GameStateValue = typeof GameState[keyof typeof GameState];
