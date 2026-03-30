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
	cubeTypes: string[];
}

const ALL_SOLVERS: SolverTab[] = [
	{key: 'cross', label: 'Cross', cubeTypes: ['333', '333oh', '333bl']},
	{key: 'xcross', label: 'XCross', cubeTypes: ['333', '333oh', '333bl']},
	{key: 'eoline', label: 'EOLine', cubeTypes: ['333', '333oh', '333bl']},
	{key: 'eocross', label: 'EOCross', cubeTypes: ['333', '333oh', '333bl']},
	{key: 'roux1', label: 'Roux S1', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333cf', label: 'Cross + F2L', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333roux', label: 'Roux S1 + S2', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333petrus', label: '2x2x2 + 2x2x3', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333zz', label: 'EOLine + ZZF2L', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333eodr', label: 'EO + DR', cubeTypes: ['333', '333oh', '333bl']},
	{key: '333222', label: '2x2x2 Block', cubeTypes: ['333', '333oh', '333bl']},
	{key: '222face', label: '2x2x2 Face', cubeTypes: ['222']},
	{key: 'sq1cs', label: 'SQ1 S1 + S2', cubeTypes: ['sq1']},
	{key: 'pyrv', label: 'Pyraminx V', cubeTypes: ['pyram']},
	{key: 'skbl1', label: 'Skewb Face', cubeTypes: ['skewb']},
];

const FACE_COLORS: Record<string, string> = {
	D: '#ffff00', U: '#ffffff', L: '#ff8c00', R: '#ff0000', F: '#00ff00', B: '#0088ff',
};

export default function CrossSolverModule() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);
	const {scramble, cubeType} = context;

	const [solverType, setSolverType] = useState<SolverType>('cross');
	const [orientation, setOrientation] = useState('z2');
	const [results, setResults] = useState<SolverResult[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const reqIdRef = useRef(0);

	const availableSolvers = useMemo(
		() => ALL_SOLVERS.filter((s) => s.cubeTypes.includes(cubeType || '')),
		[cubeType]
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
