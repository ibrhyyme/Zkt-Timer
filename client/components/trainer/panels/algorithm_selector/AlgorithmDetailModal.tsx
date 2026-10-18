import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import block from '../../../../styles/bem';
import {algToId, getStickering, getOrientationRotation, getPuzzleType, isCubeShapePuzzle, expandNotation, isLLCategory, isIsometricCategory, getDefaultFrontFace, is2DPatternCategory, getPuzzlePatternType, isSQ1MirrorCategory} from '../../../../util/trainer/algorithm_engine';
import {getLLPattern, isLLPatternsLoaded, useLLPattern} from '../../../../util/trainer/ll_patterns';
import {getIsometricPattern, isIsometricPatternsLoaded} from '../../../../util/trainer/isometric_patterns';
import {getPuzzlePattern, isPuzzlePatternsLoaded} from '../../../../util/trainer/puzzle_patterns';
import {getRemappedMask} from '../../../../util/trainer/stickering_remap';
import LLPatternView from '../LLPatternView';
import CubeIsometricView from '../CubeIsometricView';
import CubeTopPatternView from '../CubeTopPatternView';
import PyraminxPatternView from '../PyraminxPatternView';
import SkewbPatternView from '../SkewbPatternView';
import SQ1PatternView from '../SQ1PatternView';
import {saveAlgorithm, fetchDefaultAlgs, fetchLibraryCategory, getBestTime, averageOfFive, averageOfTwelve, getLastTimes, getCustomAlternatives, deleteCustomAlternative} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {Check, X, Plus} from 'phosphor-react';
import {gqlQueryTyped} from '../../../api';
import {useMe} from '../../../../util/hooks/useMe';
import {TrainerAlternativesDocument} from '../../../../@types/generated/graphql';
import type {CubeFace} from '../../types';
import {openAddToSet} from '../../sets/AddToSetSheet';
import {toAddItems} from '../../sets/add_items';

const b = block('trainer');

/** Wide enough for the picture on the left and the algorithm list on the right. */
export const ALG_DETAIL_MODAL_WIDTH = 960;

function openLogin() {
	window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
}

interface AlgorithmDetailModalProps {
	name: string;
	algorithm: string;
	category: string;
	subset: string;
	topFace: CubeFace;
	frontFace: CubeFace;
	onClose?: () => void;
}

function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function AlgorithmDetailModal({
	name,
	algorithm: initialAlgorithm,
	category,
	subset,
	topFace,
	frontFace,
	onClose,
}: AlgorithmDetailModalProps) {
	const {t} = useTranslation();
	const dbVersion = useTrainerDb();
	const me = useMe();
	const reduxDispatch = useDispatch();
	const isIso = isIsometricCategory(category);
	const effectiveFrontFace = (isLLCategory(category) || isIso) ? getDefaultFrontFace(topFace) : frontFace;

	const [editedAlg, setEditedAlg] = useState(initialAlgorithm);
	const [currentAlgorithm, setCurrentAlgorithm] = useState(initialAlgorithm);
	const [alternatives, setAlternatives] = useState<string[]>([]);
	// Signed out: how many library alternatives stay on the server (shown as a sign in link).
	const [lockedCount, setLockedCount] = useState(0);
	const [customAlts, setCustomAlts] = useState<string[]>([]);
	const [dbAlts, setDbAlts] = useState<string[]>([]);
	const isLL = isLLCategory(category);

	// Load the library alternatives (always include primary algorithm). Signing in swaps the
	// public alternatives for the full list.
	useEffect(() => {
		let alive = true;
		fetchLibraryCategory(category).then((categoryData) => {
			if (!alive || !categoryData.length) return;

			for (const sub of categoryData) {
				if (sub.subset === subset) {
					const entry = sub.algorithms.find((a) => a.name === name);
					if (entry) {
						const alts = entry.alternatives || [];
						setAlternatives([entry.algorithm, ...alts]);
						setLockedCount(me ? 0 : Math.max(0, (entry.alternativeCount || 0) - alts.length));
					}
					break;
				}
			}
		}, () => {});
		return () => {
			alive = false;
		};
	}, [category, subset, name, me?.id]);

	// Load custom alternatives (localStorage)
	useEffect(() => {
		setCustomAlts(getCustomAlternatives(category, subset, name));
	}, [category, subset, name, dbVersion]);

	// Load DB alternatives (for logged-in users)
	useEffect(() => {
		if (!me || !isLL) return;
		gqlQueryTyped(TrainerAlternativesDocument, {category, caseName: name}).then((res) => {
			if (res?.data?.trainerAlternatives) {
				setDbAlts(res.data.trainerAlternatives.map((a) => a.original_input));
			}
		}).catch(() => {});
	}, [me, category, name, isLL]);

	// Combined alternatives list: default (primary included) + DB + localStorage custom
	const allAlternatives = useMemo(() => {
		const combined = [...alternatives];
		const seen = new Set(combined.map(a => expandNotation(a)));
		const customSet = new Set(customAlts.map(a => expandNotation(a)));
		const dbSet = new Set(dbAlts.map(a => expandNotation(a)));

		// Add DB alternatives
		for (const alt of dbAlts) {
			const exp = expandNotation(alt);
			if (!seen.has(exp)) {
				combined.push(alt);
				seen.add(exp);
			}
		}

		// Add localStorage custom alternatives (not in DB)
		for (const alt of customAlts) {
			const exp = expandNotation(alt);
			if (!seen.has(exp)) {
				combined.push(alt);
				seen.add(exp);
			}
		}

		return {list: combined, customSet, dbSet};
	}, [alternatives, customAlts, dbAlts]);

	const handleDeleteCustomAlt = useCallback((alt: string) => {
		deleteCustomAlternative(category, subset, name, alt);
		setCustomAlts(getCustomAlternatives(category, subset, name));
	}, [category, subset, name]);

	const algId = algToId(currentAlgorithm);
	const best = getBestTime(algId);
	const ao5 = averageOfFive(algId);
	const ao12 = averageOfTwelve(algId);
	const solveCount = getLastTimes(algId).length;

	// 2D/3D secimi
	const puzzleType = getPuzzleType(category);
	const is3x3 = puzzleType === '3x3x3';
	const llPatternsLoaded = isLLPatternsLoaded();
	const fileLLPattern = isLL ? getLLPattern(editedAlg) : null;
	// A case the pattern file lacks (newer categories) gets its pattern generated on the device.
	const generatedLL = useLLPattern(editedAlg, isLL && !fileLLPattern);
	const llPattern = fileLLPattern ?? generatedLL.pattern;

	// Isometric pattern (WVLS, VHLS)
	const isometricPatternsLoaded = isIsometricPatternsLoaded();
	const isometricPattern = isIso ? getIsometricPattern(editedAlg) : null;

	// Puzzle pattern (2x2, 4x4, pyraminx, skewb, sq1)
	const is2DPuzzle = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);
	const puzzlePatternsLoaded = isPuzzlePatternsLoaded();
	const puzzlePattern = is2DPuzzle && puzzlePatternType ? getPuzzlePattern(puzzlePatternType, editedAlg, category) : null;

	const use3D = isIso
		? (isometricPatternsLoaded ? !isometricPattern : false)
		: isLL
			? (llPatternsLoaded ? !llPattern && !generatedLL.pending : false)
			: is2DPuzzle
				? (puzzlePatternsLoaded ? !puzzlePattern : false)
				: true;

	const twistyRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!use3D || !twistyRef.current) return;

		let cancelled = false;

		(async () => {
			const {TwistyPlayer} = await import('cubing/twisty');
			if (cancelled || !twistyRef.current) return;

			const isCube = isCubeShapePuzzle(category);
			const rotation = isCube ? getOrientationRotation(topFace, effectiveFrontFace) : '';
			const baseStickering = is3x3 ? getStickering(category) : 'full';
			const customMask = baseStickering !== 'full' ? await getRemappedMask(baseStickering, rotation) : null;

			const player = new TwistyPlayer({
				puzzle: puzzleType as any,
				visualization: '3D',
				alg: editedAlg,
				experimentalSetupAnchor: 'end',
				controlPanel: 'none',
				hintFacelets: 'none',
				experimentalDragInput: 'none',
				background: 'none',
				...(rotation ? {experimentalSetupAlg: rotation} : {}),
				...(baseStickering !== 'full' ? { experimentalStickering: baseStickering as any } : {}),
			});

			if (!cancelled && twistyRef.current) {
				twistyRef.current.innerHTML = '';
				twistyRef.current.appendChild(player);

				// Custom mask override: apply after DOM insertion
				if (customMask) {
					(player as any).experimentalStickeringMaskOrbits = customMask;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [use3D, editedAlg, category, topFace, effectiveFrontFace, puzzleType, is3x3]);

	const handleSelectAlternative = useCallback((alg: string) => {
		setEditedAlg(alg);
	}, []);

	const handleSave = useCallback(() => {
		const trimmed = editedAlg.trim();
		if (!trimmed) return;

		saveAlgorithm(category, subset, name, trimmed);
		setCurrentAlgorithm(trimmed);
	}, [editedAlg, category, subset, name]);

	const handleReset = useCallback(async () => {
		const defaults = await fetchDefaultAlgs();
		const categoryData = defaults[category];
		if (!categoryData) return;

		for (const sub of categoryData) {
			if (sub.subset === subset) {
				const original = sub.algorithms.find((a) => a.name === name);
				if (original) {
					saveAlgorithm(category, subset, name, original.algorithm);
					setCurrentAlgorithm(original.algorithm);
					setEditedAlg(original.algorithm);
					return;
				}
			}
		}
	}, [category, subset, name]);

	// "Add to set" (trainer-sets T12): the algorithm shown here goes in; a text the server does
	// not know falls back to the library one (add_items.ts).
	const handleAddToSet = useCallback(() => {
		const algorithm = editedAlg.trim() || currentAlgorithm;
		openAddToSet(reduxDispatch, t, toAddItems([{category, name, algorithm}]));
	}, [reduxDispatch, t, editedAlg, currentAlgorithm, category, name]);

	const stickering = is3x3 ? getStickering(category) : 'full';

	return (
		<div className={b('alg-detail')}>
			<div className={b('alg-detail-side')}>
				<div className={b('alg-detail-viewer')}>
					{isometricPattern ? (
						<CubeIsometricView
							pattern={isometricPattern}
							topFace={topFace}
							frontFace={effectiveFrontFace}
						/>
					) : llPattern ? (
						<LLPatternView
							pattern={llPattern}
							topFace={topFace}
							frontFace={effectiveFrontFace}
							stickering={stickering}
						/>
					) : puzzlePattern && puzzlePatternType ? (
						<>
							{puzzlePatternType === '2x2' && typeof puzzlePattern === 'string' && (
								<CubeTopPatternView pattern={puzzlePattern} layers={2} topFace={topFace} />
							)}
							{puzzlePatternType === '4x4' && typeof puzzlePattern === 'string' && (
								<CubeTopPatternView pattern={puzzlePattern} layers={4} topFace={topFace} />
							)}
							{puzzlePatternType === 'pyraminx' && typeof puzzlePattern === 'string' && (
								<PyraminxPatternView pattern={puzzlePattern} />
							)}
							{puzzlePatternType === 'skewb' && typeof puzzlePattern === 'string' && (
								<SkewbPatternView pattern={puzzlePattern} topFace={topFace} />
							)}
							{puzzlePatternType === 'sq1' && typeof puzzlePattern === 'object' && (
								<SQ1PatternView
									top={(puzzlePattern as any).t}
									bottom={(puzzlePattern as any).b}
									mirror={isSQ1MirrorCategory(category)}
								/>
							)}
						</>
					) : (
						<div
							ref={twistyRef}
							style={{
								width: '100%',
								height: '100%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						/>
					)}
				</div>

				<div className={b('alg-detail-meta')}>
					<span className={b('alg-detail-meta-pill')}>{category}</span>
					<span className={b('alg-detail-meta-pill')}>{subset}</span>
				</div>

				<div className={b('alg-detail-notation')}>
					<code>{editedAlg}</code>
				</div>

				<div className={b('alg-detail-stats')}>
					<div className={b('alg-detail-stat')}>
						<span className={b('alg-detail-stat-label')}>Best</span>
						<span className={b('alg-detail-stat-value')}>{formatTimeShort(best)}</span>
					</div>
					<div className={b('alg-detail-stat')}>
						<span className={b('alg-detail-stat-label')}>Ao5</span>
						<span className={b('alg-detail-stat-value')}>{formatTimeShort(ao5)}</span>
					</div>
					<div className={b('alg-detail-stat')}>
						<span className={b('alg-detail-stat-label')}>Ao12</span>
						<span className={b('alg-detail-stat-value')}>{formatTimeShort(ao12)}</span>
					</div>
					<div className={b('alg-detail-stat')}>
						<span className={b('alg-detail-stat-label')}>{t('trainer.solves')}</span>
						<span className={b('alg-detail-stat-value')}>{solveCount}</span>
					</div>
				</div>

				{expandNotation(editedAlg) !== expandNotation(currentAlgorithm) && (
					<div className={b('alg-detail-actions')}>
						<button className={b('alg-detail-btn', {primary: true})} onClick={handleSave}>
							{t('trainer.alg_detail_save')}
						</button>
						<button className={b('alg-detail-btn', {danger: true})} onClick={handleReset}>
							{t('trainer.alg_detail_reset')}
						</button>
					</div>
				)}

				{me && (
					<div className={b('alg-detail-actions')}>
						<button type="button" className={b('alg-detail-btn', {set: true})} onClick={handleAddToSet}>
							<Plus size={14} weight="bold" aria-hidden="true" />
							{t('trainer.sets.add_to.button')}
						</button>
					</div>
				)}
			</div>

			<div className={b('alg-detail-algs')}>
				{allAlternatives.list.length > 0 && (
					<div className={b('alg-detail-alternatives')}>
						<label className={b('alg-detail-alternatives-label')}>
							{t('trainer.alg_detail_alternatives')} ({allAlternatives.list.length - 1})
						</label>
						<div className={b('alg-detail-alternatives-list')}>
							{allAlternatives.list.map((alt, i) => {
								const exp = expandNotation(alt);
								const isSelected = exp === expandNotation(editedAlg);
								const isCustomLocal = allAlternatives.customSet.has(exp);
								const isFromDb = allAlternatives.dbSet.has(exp);
								const showDelete = isCustomLocal && !isFromDb;
								return (
									<div key={i} className={b('alg-detail-custom-alt-row')}>
										<button
											className={b('alg-detail-alt-item', {selected: isSelected})}
											onClick={() => handleSelectAlternative(alt)}
										>
											<code>{alt}</code>
											{isSelected && <Check size={14} weight="bold" />}
										</button>
										{showDelete && (
											<button
												className={b('alg-detail-alt-delete')}
												onClick={() => handleDeleteCustomAlt(alt)}
											>
												<X size={14} />
											</button>
										)}
									</div>
								);
							})}
						</div>
						{lockedCount > 0 && (
							<button type="button" className={b('alg-detail-locked')} onClick={openLogin}>
								{t('trainer.alg_detail_locked', {count: lockedCount})}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}