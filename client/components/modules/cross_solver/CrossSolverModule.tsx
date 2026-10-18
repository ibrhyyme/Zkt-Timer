import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './CrossSolverModule.scss';
import block from '../../../styles/bem';
import {useGeneral} from '../../../util/hooks/useGeneral';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import {TimerContext} from '../../timer/Timer';
import {solveCrossAsync, isCrossSolverAvailable} from '../../../util/cross-solver/worker-manager';
import {SolverResult, SolverType, STEP_SOLVER_TYPES, CUBE_ORIENTATIONS} from '../../../util/cross-solver/types';
import {CaretDown} from 'phosphor-react';
import TileMenu from '../../timer/tiles/TileMenu';
import {useCubePalette} from '../../../util/cube_colors/useCubePalette';
import {NXN_FACES} from '../../../util/cube_colors/palette';

const b = block('cross-solver');

interface SolverTab {
	key: SolverType;
	label: string;
	puzzles: string[];
}

// Tum 3x3 scramble ureten cube type'lar — tum 3x3 solver'lari bu listedekilerde calisir
const CUBE_TYPES_333 = new Set(['333', '333cfop', '333roux', '333mehta']);

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

// Puzzles drawn in the NxN colour scheme, where a face letter names a sticker colour.
// Pyraminx and Square-1 use other schemes, so their letters get no swatch.
const NXN_SCHEME_PUZZLES = new Set(['333', '222', 'skewb']);

export default function CrossSolverModule() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);
	const {scramble, cubeType, scrambleSubset} = context;
	const mobileMode = useGeneral('mobile_mode');
	const palette = useCubePalette();

	const [solverType, setSolverType] = useState<SolverType>('cross');
	const [orientation, setOrientation] = useState('z2');
	const [results, setResults] = useState<SolverResult[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const reqIdRef = useRef(0);
	const resultsRef = useRef<HTMLDivElement>(null);

	const resolvedPuzzle = useMemo(
		() => resolvePuzzle(cubeType || '', scrambleSubset),
		[cubeType, scrambleSubset]
	);

	const availableSolvers = useMemo(
		() => ALL_SOLVERS.filter((s) => s.puzzles.includes(resolvedPuzzle)),
		[resolvedPuzzle]
	);

	const hasAnySolver = availableSolvers.length > 0;
	const currentSolverLabel = (availableSolvers.find((s) => s.key === solverType) || availableSolvers[0])?.label;
	const needsOrientation = STEP_SOLVER_TYPES.includes(solverType);
	// A face solver labels each row by the face it starts from (D, D(LR), LU, URF), and the
	// row shows that face's sticker colour as a swatch. A step solver labels rows by step
	// (Cross, F2L-1, DR): no swatch, or "F2L-1" took the F face's colour. The letter itself
	// stays in the text colour: drawn in the face colour, U (white) and D (yellow) vanished
	// on the light theme (E-51).
	const faceSwatches = !needsOrientation && NXN_SCHEME_PUZZLES.has(resolvedPuzzle);
	const swatchColor = (label: string): string | null => {
		const index = NXN_FACES.indexOf(label.charAt(0) as (typeof NXN_FACES)[number]);
		return index === -1 ? null : palette.nxn[index];
	};

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

	// Long solutions (e.g. EOCross) can wrap and overflow the module. Shrink the result
	// text step by step until everything fits, instead of scrolling. This used to be
	// desktop only, and the phone's small slot showed tiny fixed-size rows with a scroll
	// bar; now the rows start large and fill the slot on both (feedback 1.9-d).
	useIsomorphicLayoutEffect(() => {
		const el = resultsRef.current;
		if (!el) return;

		const fit = () => {
			el.style.fontSize = '';
			let scale = 1;
			// scrollHeight/clientHeight are rounded ints; 1px tolerance avoids false shrinks
			while (el.scrollHeight - el.clientHeight > 1 && scale > 0.7) {
				scale -= 0.05;
				el.style.fontSize = `${scale}em`;
			}
		};

		fit();
		// Font changes don't alter the element's own box (flex: 1), so no observer loop
		const ro = new ResizeObserver(fit);
		ro.observe(el);
		return () => ro.disconnect();
	}, [results, loading, error, mobileMode]);

	const minMoveCount = useMemo(() => {
		if (!results) return Infinity;
		const counts = results.filter((r) => r.moveCount > 0).map((r) => r.moveCount);
		return counts.length > 0 ? Math.min(...counts) : Infinity;
	}, [results]);

	if (!hasAnySolver) {
		return (
			<div className={b({desktop: !mobileMode})}>
				<div className={b('empty')}>{t('cross_solver.not_supported')}</div>
			</div>
		);
	}

	return (
		<div className={b({desktop: !mobileMode})}>
			{/* A header, not a form: the solver's name is the title and opens the list of
			    solvers, the same menu the module titles use. Two native <select> boxes
			    used to sit here and read like a spreadsheet listbox (feedback 1.9-c). */}
			<div className={b('toolbar')}>
				<TileMenu
					options={availableSolvers.map((st) => ({
						key: st.key,
						label: st.label,
						selected: st.key === solverType,
						onSelect: () => setSolverType(st.key),
					}))}
					title={t('cross_solver.solver_label')}
					className={b('picker')}
				>
					<span className={b('picker-label')}>{currentSolverLabel}</span>
					<CaretDown weight="bold" className={b('picker-caret')} />
				</TileMenu>
				{needsOrientation && (
					<TileMenu
						options={CUBE_ORIENTATIONS.map((ori) => ({
							key: ori || 'none',
							label: ori || t('cross_solver.no_rotation'),
							selected: ori === orientation,
							onSelect: () => setOrientation(ori),
						}))}
						title={t('cross_solver.orientation_label')}
						className={b('picker', {secondary: true})}
					>
						<span className={b('picker-label')}>{orientation || t('cross_solver.no_rotation')}</span>
						<CaretDown weight="bold" className={b('picker-caret')} />
					</TileMenu>
				)}
			</div>

			<div className={b('results')} ref={resultsRef}>
				{loading && <div className={b('empty')}>{t('cross_solver.solving')}</div>}
				{error && <div className={b('error')}>{error}</div>}
				{!loading && !error && results && results.map((r, i) => (
					<div key={i} className={b('row', {best: r.moveCount === minMoveCount && r.moveCount > 0})}>
						<span className={b('face')}>
							{faceSwatches && swatchColor(r.face) && (
								<span className={b('swatch')} style={{background: swatchColor(r.face)}} aria-hidden="true" />
							)}
							{r.face}:
						</span>
						{r.rotation && <span className={b('rot')}>{r.rotation}</span>}
						<span className={b('moves')}>
							{r.solution.length > 0
								? r.solution.map((m, j) => <span key={j} className={b('move')}>{m}</span>)
								: t('cross_solver.already_solved')}
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
