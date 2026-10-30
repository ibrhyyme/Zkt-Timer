import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@apollo/client';
import { SolveReplayDataDocument } from '../../../@types/generated/graphql';
import ReconstructionVote from './ReconstructionVote';
import { f2lSlotFaces } from '../util/f2l_slots';
import { STICKER_PALETTE } from '../../timer/smart_cube/cube_view/cube_palette';
import { useMe } from '../../../util/hooks/useMe';
import { canSeeSmartAnalysis } from '../../../lib/pro';
import { decodeGyroSamples } from '../../../../shared/smart_cube/gyro_codec';
import { reconstructFromState } from '../../../../shared/smart_cube/state_reconstruction';
import { useLastLayerAlgs } from './useLastLayerAlgs';
import './SolutionInfo.scss';
import CopyText from '../../common/copy_text/CopyText';
import { getSolveStepsWithoutParents } from '../util/solution';
import { getCrossRotation, getCrossSide, transformMoves } from '../util/cross_rotation';
import { getStepDisplayName } from '../util/consts';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';
import ReplayPlayer, { GyroReplay } from './replay/ReplayPlayer';
import { useFlattenedMoves } from './replay/useFlattenedMoves';
import { buildSmartSolveCopyText, buildSmartSolveDetailedCopyText } from './solution_copy_text';
import { parseSmartTurns } from '../../../../shared/smart_cube/parse_turns';
import {
	ReconstructionToken,
	framesAlongTokens,
	splitTurnsBySteps,
} from '../../../../shared/smart_cube/rotation_reconstruction';

const b = block('solve-info-solution-info');

/** Sticker colour of each core face (a smart cube's core U is the white centre). */
const FACE_RGB: Record<string, readonly [number, number, number]> = {
	U: STICKER_PALETTE.white,
	D: STICKER_PALETTE.yellow,
	F: STICKER_PALETTE.green,
	B: STICKER_PALETTE.blue,
	R: STICKER_PALETTE.red,
	L: STICKER_PALETTE.orange,
};

const faceRgb = (face: string) => `rgb(${FACE_RGB[face].join(',')})`;

/**
 * A square split corner to corner: the slot's left face bottom-left, its right face top-right,
 * a thin gap between. Two flat triangles, not a gradient (design_language.test.ts).
 */
function SlotMark({ left, right, className }: { left: string; right: string; className: string }) {
	return (
		<svg className={className} viewBox="0 0 12 12" aria-hidden="true">
			<polygon points="0,1.2 0,12 10.8,12" fill={faceRgb(left)} />
			<polygon points="1.2,0 12,0 12,10.8" fill={faceRgb(right)} />
		</svg>
	);
}

interface Props {
	solve: Solve;
}

export default function SolutionInfo(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();
	const steps = getSolveStepsWithoutParents(solve);

	// [SOLUTION_INFO] window.__SMART_DEBUG__ ile aktif. steps array sirasi (render_idx) vs step_index degerleri.
	// Eger render_idx=0'da step_index=5 cikiyorsa client'ta siralama atlanmis demek; tutarli ise sorun backend'den gelmis.
	React.useEffect(() => {
		if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
		const summary = steps.map((s, i) => ({
			render_idx: i,
			step_index: (s as any).step_index,
			step_name: s.step_name,
			parent_name: s.parent_name,
			turns_head: (s.turns || '').slice(0, 30)
		}));
		console.log('%c[SOLUTION_INFO]', 'color:#00BCD4;font-weight:bold',
			`solve=${solve.id} | steps=${steps.length}`, summary);
	}, [solve.id, steps.length]);

	const crossStep = steps.find((s) => s.step_name === 'cross');
	const rotation = useMemo(
		() => (crossStep ? getCrossRotation(solve.scramble, crossStep.turns) : ''),
		[solve.scramble, crossStep?.turns]
	);

	// The raw gyro stream and the owner's verdict (in no sync read). solveReplayData answers the
	// owner, and with the share code anyone viewing the shared link, so they see the cube move as
	// it did; on the same Pro rule as this tab. Only the replay and the vote use it: the table
	// does not wait for it.
	const me = useMe();
	const canFetchReplayData = canSeeSmartAnalysis(me, solve.user) && solve.smart_rotations != null && !!solve.id;
	const replayVariables = { id: solve.id, shareCode: solve.share_code || null };
	const { data: replayData } = useQuery(SolveReplayDataDocument, {
		variables: replayVariables,
		skip: !canFetchReplayData,
		fetchPolicy: 'cache-first',
		ssr: false,
	});
	const rawGyro = replayData?.solveReplayData?.smart_gyro;
	const gyroSamples = useMemo(() => decodeGyroSamples(rawGyro), [rawGyro]);

	// Which raw turns each step was built from, for the rows and the slot marks both. Keyed on
	// the step moves, not the array: `steps` is rebuilt on every render, and the replay
	// re-renders this on every move it plays.
	const stepTurnsKey = steps.map((s) => s.turns || '').join('|');
	const stepNamesKey = steps.map((s) => s.step_name).join('|');
	const ranges = useMemo(() => {
		if (!solve.smart_turns) return null;
		return splitTurnsBySteps(parseSmartTurns(solve.smart_turns).map((tu) => tu.turn), stepTurnsKey.split('|'));
	}, [solve.smart_turns, stepTurnsKey]);

	// The two side colours of the slot each F2L step filled, played out on a cube from the
	// recorded turns; any smart solve has them, gyro or not.
	const slotFaces = useMemo(() => {
		if (!solve.smart_turns || !solve.scramble || !ranges) return null;
		const turns = parseSmartTurns(solve.smart_turns).map((tu) => tu.turn);
		const crossFace = crossStep ? getCrossSide(solve.scramble, crossStep.turns) : null;
		return f2lSlotFaces(solve.scramble, turns, ranges, stepNamesKey.split('|'), crossFace);
	}, [solve.smart_turns, solve.scramble, ranges, stepNamesKey, crossStep?.turns]);

	// A gyro solve's rows show the moves as the solver held the cube: the rotation each step
	// was held with, slices put together, a known OLL / PLL written as that algorithm
	// (state_reconstruction.ts). Read from the moves and the cube's state alone; the gyro only
	// turns the replay. Null keeps the plain rows: no gyro solve, or steps that do not line up
	// with the turns.
	const isGyroSolve = solve.smart_rotations != null && !!solve.smart_turns;
	const lastLayerAlgs = useLastLayerAlgs(isGyroSolve);
	// The replay steps through these same tokens, so a replay position is a token: a rotation
	// is a step of its own, an M2 plays as one, and the row highlight is exact.
	const reading = useMemo(() => {
		if (!isGyroSolve || !ranges) return null;
		const turns = parseSmartTurns(solve.smart_turns);
		if (!turns.length) return null;
		const names = stepNamesKey.split('|');
		const { holding, tokens } = reconstructFromState(
			turns,
			ranges.map((range, i) => ({
				range,
				slot: slotFaces?.[i] ? ([slotFaces[i]!.left, slotFaces[i]!.right] as const) : null,
				algs: names[i] === 'oll' ? lastLayerAlgs?.oll : names[i] === 'pll' ? lastLayerAlgs?.pll : null,
			})),
			rotation
		);
		const byStep = ranges.map(([start, end]) => tokens.filter((k) => k.rawStart >= start && k.rawStart < end));
		const offsets: number[] = [];
		let at = 0;
		for (const stepTokens of byStep) {
			offsets.push(at);
			at += stepTokens.length;
		}
		const t0 = turns[0].completedAt;
		return {
			holding,
			/** Position of each step's first token. */
			offsets,
			byStep,
			moves: byStep.flatMap((stepTokens, stepIdx) =>
				stepTokens.map((k) => ({
					// The core turns behind the token, as the cube reported them; none for a rotation.
					move: k.raws.map((r) => turns[r].turn).join(' '),
					relativeMs: k.t - t0,
					stepIdx,
				}))
			),
			frames: framesAlongTokens(byStep.flat(), holding),
			t0,
		};
	}, [isGyroSolve, solve.smart_turns, ranges, slotFaces, stepNamesKey, rotation, lastLayerAlgs]);
	const gyroReplay = useMemo(
		(): GyroReplay | null =>
			reading && {
				moves: reading.moves,
				frames: reading.frames,
				stepStarts: reading.offsets,
				t0: reading.t0,
				samples: gyroSamples,
			},
		[reading, gyroSamples]
	);
	const readingByStep: ReconstructionToken[][] | null = reading?.byStep || null;
	const holdingShown = reading ? reading.holding : rotation;

	// Replay state — SolutionInfo tutuyor, ReplayPlayer'a controlled prop olarak geciyor.
	// Boylece tablo da aktif hamleyi highlight edebilir + step row'a tiklanca seek edebilir.
	// currentMoveIdx FLAT QUARTER index'i (U3 → 3 ayri quarter). Token highlight icin
	// tokenStartIndices/tokenQuarterCounts kullaniyoruz.
	const [currentMoveIdx, setCurrentMoveIdx] = useState(0);
	const { stepStartIndices, tokenStartIndices, tokenQuarterCounts } = useFlattenedMoves(steps);

	// Both clipboard texts come from the steps and rotation the table below renders, so what
	// is copied is what is on screen (see solution_copy_text.ts).
	const copyText = buildSmartSolveCopyText(t, solve);
	const detailedCopyText = buildSmartSolveDetailedCopyText(
		t,
		solve,
		steps,
		rotation,
		reading ? { holding: reading.holding, byStep: reading.byStep.map((tokens) => tokens.map((k) => k.move)) } : undefined
	);

	return (
		<div className={b()}>
			<div className={b('column', { table: true })}>
				<table className={b('table')}>
					<thead>
						<tr>
							<th>{t('solve_info.step')}</th>
							<th>
								<div className={b('turns-head')}>
									<span>{t('solve_info.turns')}</span>
									<CopyText
										text={copyText}
										buttonProps={{ text: '', small: true }}
									/>
									<CopyText
										text={detailedCopyText}
										buttonProps={{ text: t('solve_info.copy_detailed'), small: true }}
										toastifyMessageOnCopy={t('solve_info.copied_detailed')}
									/>
								</div>
							</th>
						</tr>
					</thead>
					<tbody>
						{steps.map((step, sIdx) => {
							const isCross = step.step_name === 'cross';
							const stepStartGlobal = reading ? reading.offsets[sIdx] : (stepStartIndices[sIdx] ?? 0);
							// Step toplam quarter sayisi = sIdx step'inin tum tokenlarinin quarter toplam'i
							const stepQuarterCount = reading
								? reading.byStep[sIdx].length
								: (tokenQuarterCounts[sIdx] || []).reduce((s, n) => s + n, 0);
							// Step row aktif mi? currentMoveIdx = "siradaki uygulanacak quarter" pozisyonu.
							const isActiveStep = currentMoveIdx >= stepStartGlobal &&
								currentMoveIdx < stepStartGlobal + stepQuarterCount;

							return (
								<tr
									key={step.step_name}
									className={b('row', { active: isActiveStep, clickable: true })}
									onClick={() => setCurrentMoveIdx(stepStartGlobal)}
								>
									<td className={b('step-name')}>
										{slotFaces?.[sIdx] && (
											<SlotMark className={b('slot')} left={slotFaces[sIdx]!.left} right={slotFaces[sIdx]!.right} />
										)}
										{getStepDisplayName(step)}
									</td>
									<td className={b('step-turns')}>
										{isCross && holdingShown && (
											<span className={b('rotation')}>{holdingShown}</span>
										)}
										{readingByStep && readingByStep[sIdx].map((token, kIdx) => {
											// One replay position per token here.
											const position = stepStartGlobal + kIdx;
											const isCurrent = currentMoveIdx - 1 === position;
											return (
												<span
													key={`${sIdx}-g${kIdx}`}
													className={b('move', { rotation: token.kind === 'rotation', current: isCurrent })}
													onClick={(e) => {
														e.stopPropagation();
														setCurrentMoveIdx(position + 1);
													}}
												>
													{token.move}
												</span>
											);
										})}
										{!readingByStep && ((step.turns || '').split(' ').filter(Boolean) as string[]).map((rawMove: string, mIdx: number) => {
											// Bu token hangi flat-quarter aralikta? U3 → 3 quarter'i kapsar.
											const tokenStart = (tokenStartIndices[sIdx] || [])[mIdx] ?? (stepStartGlobal + mIdx);
											const tokenQuarters = (tokenQuarterCounts[sIdx] || [])[mIdx] ?? 1;
											// currentMoveIdx-1 = son uygulanan quarter index'i. Token'in range'inde mi?
											const lastApplied = currentMoveIdx - 1;
											const isCurrent = lastApplied >= tokenStart && lastApplied < tokenStart + tokenQuarters;
											// BLE CORE hamlesini kullanicinin pozisyonel perspectifine cevir.
											// Ornek: z2 cross → BLE "R" → kullanici icin "L" (cube'in fiziksel sol yuzu).
											const displayMove = rotation
												? transformMoves(rawMove, rotation)
												: rawMove;
											return (
												<span
													key={`${sIdx}-${mIdx}`}
													className={b('move', { current: isCurrent })}
													onClick={(e) => {
														e.stopPropagation();
														setCurrentMoveIdx(tokenStart + tokenQuarters);
													}}
												>
													{displayMove}
												</span>
											);
										})}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				{/* The verdict is the owner's; a viewer of the shared link is not asked. */}
				{reading && replayData?.solveReplayData?.is_owner && (
					<ReconstructionVote
						replayVariables={replayVariables}
						vote={replayData.solveReplayData.reconstruction_vote ?? null}
					/>
				)}
			</div>
			<div className={b('column', { replay: true })}>
				<ReplayPlayer
					solve={solve}
					steps={steps}
					rotation={holdingShown}
					gyroReplay={gyroReplay}
					currentMoveIdx={currentMoveIdx}
					onMoveIdxChange={setCurrentMoveIdx}
				/>
			</div>
		</div>
	);
}
