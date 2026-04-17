import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './CrossSolverModule.scss';
import block from '../../../styles/bem';
import {TimerContext} from '../../timer/Timer';
import {solveCrossAsync, isCrossSolverAvailable} from '../../../util/cross-solver/worker-manager';
import {SolverResult, SolverType, STEP_SOLVER_TYPES, CUBE_ORIENTATIONS} from '../../../util/cross-solver/types';

const b = block('cross-solver');

interface SolverTab {
	key: SolverType;
	label: string;
	puzzles: string[];
}

// Tum 3x3 scramble ureten cube type'lar — tum 3x3 solver'lari bu listedekilerde calisir
const CUBE_TYPES_333 = new Set(['333', '333cfop', '333roux', '333mehta', '333zz', '333sub']);

// Cube type + subset -> gercek puzzle turu cozumu
// WCA kategorisinde subset bizzat puzzle turudur (333, 222, sq1, vs)
// Diger cube type'larda subset scramble varyantidir, puzzle turu cube type'tan gelir
function resolvePuzzle(cubeType: string, subset?: string): string {
	if (cubeType === 'wca') {
		// WCA: subset puzzle turu. Subset yoksa default 3x3.
		return subset || '333';
	}
	if (CUBE_TYPES_333.has(cubeType)) {
		return '333';
	}
	return cubeType;
}

const ALL_SOLVERS: SolverTab[] = [
	{key: 'cross', label: 'Cross', puzzles: ['333']},
	{key: 'xcross', label: 'XCross', puzzles: ['333']},
	{key: 'eoline', label: 'EOLine', puzzles: ['333']},
	{key: 'eocross', label: 'EOCross', puzzles: ['333']},
	{key: 'roux1', label: 'Roux S1', puzzles: ['333']},
	{key: '333cf', label: 'Cross + F2L', puzzles: ['333']},
	{key: '333roux', label: 'Roux S1 + S2', puzzles: ['333']},
	{key: '333petrus', label: '2x2x2 + 2x2x3', puzzles: ['333']},
	{key: '333zz', label: 'EOLine + ZZF2L', puzzles: ['333']},
	{key: '333eodr', label: 'EO + DR', puzzles: ['333']},
	{key: '333222', label: '2x2x2 Block', puzzles: ['333']},
	{key: '222face', label: '2x2x2 Face', puzzles: ['222']},
	{key: 'sq1cs', label: 'SQ1 S1 + S2', puzzles: ['sq1']},
	{key: 'pyrv', label: 'Pyraminx V', puzzles: ['pyram']},
	{key: 'skbl1', label: 'Skewb Face', puzzles: ['skewb']},
];

const FACE_COLORS: Record<string, string> = {
	D: '#ffff00', U: '#ffffff', L: '#ff8c00', R: '#ff0000', F: '#00ff00', B: '#0088ff',
};

export default function CrossSolverModule() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);
	const {scramble, cubeType, scrambleSubset} = context;

	const [solverType, setSolverType] = useState<SolverType>('cross');
	const [orientation, setOrientation] = useState('z2');
	const [results, setResults] = useState<SolverResult[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const reqIdRef = useRef(0);

	const resolvedPuzzle = useMemo(
		() => resolvePuzzle(cubeType || '', scrambleSubset),
		[cubeType, scrambleSubset]
	);

	const availableSolvers = useMemo(
		() => ALL_SOLVERS.filter((s) => s.puzzles.includes(resolvedPuzzle)),
		[resolvedPuzzle]
	);

	const hasAnySolver = availableSolvers.length > 0;
	const needsOrientation = STEP_SOLVER_TYPES.includes(solverType);

	useEffect(() => {
		if (availableSolvers.length > 0 && !availableSolvers.find((s) => s.key === solverType)) {
			setSolverType(availableSolvers[0].key);
		}
	}, [availableSolvers]);

	useEffect(() => {
		if (!scramble || !hasAnySolver || !isCrossSolverAvailable()) {
			setResults(null);
			return;
		}

		const currentReqId = ++reqIdRef.current;
		setLoading(true);
		setError(null);

		const ori = needsOrientation ? orientation : undefined;
		solveCrossAsync(scramble, solverType, ori)
			.then((res) => {
				if (reqIdRef.current === currentReqId) {
					setResults(res);
					setLoading(false);
				}
			})
			.catch((e) => {
				if (reqIdRef.current === currentReqId) {
					setError(e.message || t('cross_solver.error'));
					setLoading(false);
				}
			});
	}, [scramble, solverType, orientation, hasAnySolver, needsOrientation]);

	const minMoveCount = useMemo(() => {
		if (!results) return Infinity;
		const counts = results.filter((r) => r.moveCount > 0).map((r) => r.moveCount);
		return counts.length > 0 ? Math.min(...counts) : Infinity;
	}, [results]);

	if (!hasAnySolver) {
		return (
			<div className={b()}>
				<div className={b('empty')}>{t('cross_solver.not_supported')}</div>
			</div>
		);
	}

	return (
		<div className={b()}>
			<div className={b('toolbar')}>
				<select
					className={b('select')}
					value={solverType}
					onChange={(e) => setSolverType(e.target.value as SolverType)}
				>
					{availableSolvers.map((st) => (
						<option key={st.key} value={st.key}>{st.label}</option>
					))}
				</select>
				{needsOrientation && (
					<select
						className={b('select', {small: true})}
						value={orientation}
						onChange={(e) => setOrientation(e.target.value)}
					>
						{CUBE_ORIENTATIONS.map((ori) => (
							<option key={ori} value={ori}>{ori || '(none)'}</option>
						))}
					</select>
				)}
			</div>

			<div className={b('results')}>
				{loading && <div className={b('empty')}>{t('cross_solver.solving')}</div>}
				{error && <div className={b('error')}>{error}</div>}
				{!loading && !error && results && results.map((r, i) => (
					<div key={i} className={b('row', {best: r.moveCount === minMoveCount && r.moveCount > 0})}>
						<span
							className={b('face')}
							style={{color: FACE_COLORS[r.face.charAt(0)] || 'inherit'}}
						>
							{r.face}:
						</span>
						{r.rotation && <span className={b('rot')}>{r.rotation}</span>}
						<span className={b('moves')}>
							{r.solution.length > 0
								? r.solution.map((m, j) => <span key={j} className={b('move')}>{m}</span>)
								: '(skip)'}
						</span>
					</div>
				))}
				{!loading && !error && !results && (
					<div className={b('empty')}>{t('cross_solver.no_scramble')}</div>
				)}
			</div>
		</div>
	);
}
