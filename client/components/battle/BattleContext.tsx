import React, { createContext, useContext, useReducer } from 'react';
import { getNewScramble } from '../timer/helpers/scramble';

export interface BattleSolve {
	time: number;
	plusTwo: boolean;
	dnf: boolean;
	scramble: string;
	roundIndex: number;
}

export interface BattleRound {
	scramble: string;
	player1Solve?: BattleSolve;
	player2Solve?: BattleSolve;
	winner?: 1 | 2 | 'tie';
}

export interface BattleSettings {
	showTimeWhenSolving: boolean;
	showScramble: boolean;
	showPlayerNames: boolean;
	showStatistics: boolean;
	showScore: boolean;
	showWinStreak: boolean;
	cubeType: string;
	player1Name: string;
	player2Name: string;
}

export interface BattleState {
	rounds: BattleRound[];
	currentRound: number;
	currentScramble: string;
	player1Score: number;
	player2Score: number;
	settings: BattleSettings;
	winStreak: { player: 1 | 2 | null; count: number };
	menuOpen: boolean;
	historyOpen: boolean;
	// Sync start
	player1Ready: boolean;
	player2Ready: boolean;
	roundStartedAt: number | null;
}

type BattleAction =
	| { type: 'PLAYER_SOLVE'; player: 1 | 2; solve: BattleSolve }
	| { type: 'NEXT_ROUND' }
	| { type: 'CHANGE_SCRAMBLE' }
	| { type: 'DELETE_LAST_ROUND' }
	| { type: 'SWITCH_SIDES' }
	| { type: 'UPDATE_SETTINGS'; settings: Partial<BattleSettings> }
	| { type: 'TOGGLE_MENU' }
	| { type: 'TOGGLE_HISTORY' }
	| { type: 'RESET' }
	| { type: 'PLAYER_READY'; player: 1 | 2 }
	| { type: 'PLAYER_UNREADY'; player: 1 | 2 }
	| { type: 'START_ROUND'; startTime: number };

function getEffectiveTime(solve: BattleSolve): number {
	if (solve.dnf) return Infinity;
	return solve.plusTwo ? solve.time + 2 : solve.time;
}

function determineWinner(p1: BattleSolve, p2: BattleSolve): 1 | 2 | 'tie' {
	const t1 = getEffectiveTime(p1);
	const t2 = getEffectiveTime(p2);
	if (t1 === t2) return 'tie';
	return t1 < t2 ? 1 : 2;
}

function updateStreak(
	prev: { player: 1 | 2 | null; count: number },
	winner: 1 | 2 | 'tie'
): { player: 1 | 2 | null; count: number } {
	if (winner === 'tie') return { player: null, count: 0 };
	if (prev.player === winner) return { player: winner, count: prev.count + 1 };
	return { player: winner, count: 1 };
}

function battleReducer(state: BattleState, action: BattleAction): BattleState {
	switch (action.type) {
		case 'PLAYER_SOLVE': {
			const rounds = [...state.rounds];
			const round = { ...rounds[state.currentRound] };
			const previousWinner = round.winner;

			if (action.player === 1) {
				round.player1Solve = action.solve;
			} else {
				round.player2Solve = action.solve;
			}

			if (round.player1Solve && round.player2Solve) {
				round.winner = determineWinner(round.player1Solve, round.player2Solve);
			}

			rounds[state.currentRound] = round;

			let { player1Score, player2Score, winStreak } = state;

			if (round.winner) {
				if (!previousWinner) {
					// Ilk kez winner belirlendi
					if (round.winner === 1) player1Score++;
					else if (round.winner === 2) player2Score++;
					winStreak = updateStreak(state.winStreak, round.winner);
				} else if (round.winner !== previousWinner) {
					// Penalty ile winner degisti — eski skoru geri al, yenisini ekle
					if (previousWinner === 1) player1Score--;
					else if (previousWinner === 2) player2Score--;
					if (round.winner === 1) player1Score++;
					else if (round.winner === 2) player2Score++;
					winStreak = updateStreak(state.winStreak, round.winner);
				}
			}

			return { ...state, rounds, player1Score, player2Score, winStreak, roundStartedAt: null };
		}

		case 'NEXT_ROUND': {
			const newScramble = getNewScramble(state.settings.cubeType);
			const newRound: BattleRound = { scramble: newScramble };
			return {
				...state,
				rounds: [...state.rounds, newRound],
				currentRound: state.currentRound + 1,
				currentScramble: newScramble,
				roundStartedAt: null,
			};
		}

		case 'CHANGE_SCRAMBLE': {
			const newScramble = getNewScramble(state.settings.cubeType);
			const rounds = [...state.rounds];
			rounds[state.currentRound] = { ...rounds[state.currentRound], scramble: newScramble };
			return { ...state, rounds, currentScramble: newScramble };
		}

		case 'DELETE_LAST_ROUND': {
			if (state.rounds.length <= 1) return state;

			const deletedRound = state.rounds[state.rounds.length - 1];
			let { player1Score, player2Score } = state;

			if (deletedRound.winner === 1) player1Score--;
			else if (deletedRound.winner === 2) player2Score--;

			const rounds = state.rounds.slice(0, -1);
			const currentRound = rounds.length - 1;

			return {
				...state,
				rounds,
				currentRound,
				currentScramble: rounds[currentRound].scramble,
				player1Score,
				player2Score,
				winStreak: { player: null, count: 0 },
				roundStartedAt: null,
			};
		}

		case 'SWITCH_SIDES': {
			const rounds = state.rounds.map((r) => ({
				...r,
				player1Solve: r.player2Solve,
				player2Solve: r.player1Solve,
				winner: r.winner === 1 ? (2 as const) : r.winner === 2 ? (1 as const) : r.winner,
			}));

			return {
				...state,
				rounds,
				player1Score: state.player2Score,
				player2Score: state.player1Score,
				settings: {
					...state.settings,
					player1Name: state.settings.player2Name,
					player2Name: state.settings.player1Name,
				},
				winStreak: {
					player: state.winStreak.player === 1 ? 2 : state.winStreak.player === 2 ? 1 : null,
					count: state.winStreak.count,
				},
			};
		}

		case 'UPDATE_SETTINGS':
			return { ...state, settings: { ...state.settings, ...action.settings } };

		case 'TOGGLE_MENU':
			return { ...state, menuOpen: !state.menuOpen, historyOpen: false };

		case 'TOGGLE_HISTORY':
			return { ...state, historyOpen: !state.historyOpen, menuOpen: false };

		case 'RESET': {
			const scramble = getNewScramble(state.settings.cubeType);
			return {
				...createInitialState(state.settings.cubeType, scramble),
				settings: state.settings,
			};
		}

		// Sync start actions
		case 'PLAYER_READY': {
			if (action.player === 1) return { ...state, player1Ready: true };
			return { ...state, player2Ready: true };
		}

		case 'PLAYER_UNREADY': {
			if (action.player === 1) return { ...state, player1Ready: false };
			return { ...state, player2Ready: false };
		}

		case 'START_ROUND': {
			const round = state.rounds[state.currentRound];
			const bothDone = !!round.player1Solve && !!round.player2Solve;

			if (bothDone) {
				// Onceki tur tamamlanmis — yeni tur olustur + baslat
				const newScramble = getNewScramble(state.settings.cubeType);
				return {
					...state,
					rounds: [...state.rounds, { scramble: newScramble }],
					currentRound: state.currentRound + 1,
					currentScramble: newScramble,
					roundStartedAt: action.startTime,
					player1Ready: false,
					player2Ready: false,
				};
			}

			// Ilk tur veya tamamlanmamis tur — sadece baslat
			return {
				...state,
				roundStartedAt: action.startTime,
				player1Ready: false,
				player2Ready: false,
			};
		}

		default:
			return state;
	}
}

function createInitialState(cubeType: string = '333', scramble?: string): BattleState {
	const initialScramble = scramble || getNewScramble(cubeType);
	return {
		rounds: [{ scramble: initialScramble }],
		currentRound: 0,
		currentScramble: initialScramble,
		player1Score: 0,
		player2Score: 0,
		settings: {
			showTimeWhenSolving: true,
			showScramble: true,
			showPlayerNames: true,
			showStatistics: true,
			showScore: true,
			showWinStreak: true,
			cubeType,
			player1Name: 'Player 1',
			player2Name: 'Player 2',
		},
		winStreak: { player: null, count: 0 },
		menuOpen: false,
		historyOpen: false,
		player1Ready: false,
		player2Ready: false,
		roundStartedAt: null,
	};
}

interface BattleContextValue {
	state: BattleState;
	dispatch: React.Dispatch<BattleAction>;
}

const BattleCtx = createContext<BattleContextValue | null>(null);

export function BattleProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(battleReducer, createInitialState());

	return <BattleCtx.Provider value={{ state, dispatch }}>{children}</BattleCtx.Provider>;
}

export function useBattle() {
	const ctx = useContext(BattleCtx);
	if (!ctx) throw new Error('useBattle must be used within BattleProvider');
	return ctx;
}
