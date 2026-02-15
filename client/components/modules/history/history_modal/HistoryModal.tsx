import React, { useMemo } from 'react';
import './HistoryModal.scss';
import { Copy, ShareNetwork } from 'phosphor-react';
import block from '../../../../styles/bem';
import { getTimeString } from '../../../../util/time';
import SolvesText from '../../solves_text/SolvesText';
import Button, { CommonType } from '../../../common/button/Button';
import { getCubeTypeInfoById } from '../../../../util/cubes/util';
import { Solve } from '../../../../../server/schemas/Solve.schema';

const b = block('history-modal');

import { FilterSolvesOptions } from '../../../../db/solves/query';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import { getStatsBlockValueFromFilter } from '../../quick_stats/util';
import { useSolveDb } from '../../../../util/hooks/useSolveDb';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useDispatch } from 'react-redux';
import { closeModal, openModal } from '../../../../actions/general';
import SolveInfo from '../../../solve_info/SolveInfo';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { copyText } from '../../../common/copy_text/CopyText';
import { generateAverageText } from '../../../../util/average_text';
import { toastSuccess } from '../../../../util/toast';

interface Props {
	solves?: Solve[];
	description?: string;
	time?: number;
	disabled?: boolean;
	showAsText?: boolean;
	statOptions?: StatsModuleBlock;
	filterOptions?: FilterSolvesOptions;
}

function getTrimmedSolveIds(solves: Solve[]): Set<string> {
	const ids = new Set<string>();
	if (solves.length < 5) return ids;

	const sorted = [...solves].sort((a, b) => {
		const aTime = a.dnf ? Infinity : a.time;
		const bTime = b.dnf ? Infinity : b.time;
		return aTime - bTime;
	});

	const dropCount = Math.ceil(Math.max(1, solves.length * 0.05));

	for (let i = 0; i < dropCount; i++) {
		ids.add(sorted[i].id);
		ids.add(sorted[sorted.length - 1 - i].id);
	}

	return ids;
}

export default function HistoryModal(props: Props) {
	const { description, showAsText, statOptions, filterOptions } = props;
	// Default to ascending (oldest first, 1..N) for mobile to match reference
	// But let's check: reference shows "1. 0.514", "2. 0.394"... and dates are 12/02/26
	// This implies standard order (1 is first solve).
	// Existing code sorted by `started_at` descending (newest first).
	// To match reference "1. ...", we usually want Oldest -> Newest if we are indexing 1 to N properly.
	// Let's stick with the user's wish for "Reference Style".
	// The reference image has 1 at top.
	// Sıralama: eskiden yeniye (1..N)
	// solves = sort(b.started - a.started) => Newest First
	// reverseOrder=true => [...solves].reverse() => Oldest First
	const reverseOrder = true;

	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	const sessionId = useSettings('session_id');
	useSolveDb(); // Trigger re-render on DB changes

	// Live data calculation
	const liveData = useMemo(() => {
		if (statOptions) {
			return getStatsBlockValueFromFilter(statOptions, filterOptions, sessionId);
		}
		return null;
	}, [statOptions, filterOptions, sessionId, useSolveDb()]); // useSolveDb returns version/trigger

	// Eğer canlı moddaysak ve veri gelmiyorsa (örn: AO12 için 11 süre kaldıysa), modalı kapat
	React.useEffect(() => {
		if (statOptions && liveData === null) {
			dispatch(closeModal());
		}
	}, [statOptions, liveData]);

	const effectiveSolves = liveData ? liveData.solves : props.solves;
	const effectiveTime = liveData ? liveData.time : props.time;

	const timeString = getTimeString(effectiveTime);

	const solves = useMemo(() => {
		if (!effectiveSolves) return [];
		return [...effectiveSolves].sort((a, b) => b.started_at - a.started_at);
	}, [effectiveSolves]);

	const cubeTypes = useMemo(() => {
		const types = new Set<string>();
		for (const solve of solves) {
			types.add(solve.cube_type);
		}

		const output = [];
		for (const type of types) {
			const cubeName = getCubeTypeInfoById(type).name;
			output.push(cubeName);
		}

		return output;
	}, [solves, solves?.length]);

	const trimmedIds = useMemo(() => getTrimmedSolveIds(solves), [solves]);

	const lastSolve = solves[solves.length - 1];
	const isSingleSolve = solves.length === 1;

	// Mobil kopyala/paylaş fonksiyonları
	function handleCopy() {
		// Use reverseOrder directly to match view
		const text = generateAverageText(description, effectiveTime, solves, reverseOrder);
		copyText(text);
		toastSuccess('Average kopyalandı');
	}

	async function handleShare() {
		const text = generateAverageText(description, effectiveTime, solves, reverseOrder);
		copyText(text);
		if (navigator.share) {
			try {
				await navigator.share({ text });
			} catch (e) {
				// Kullanıcı paylaşımı iptal etti
			}
		}
		toastSuccess('Average kopyalandı');
	}

	function handleDone() {
		dispatch(closeModal());
	}

	function openSolve(solve: Solve) {
		dispatch(openModal(<SolveInfo solve={solve} solveId={solve.id} />, { width: 1000 }));
	}

	// Mobil layout (tek çözüm hariç)
	if (mobileMode && !isSingleSolve) {
		const displaySolves = reverseOrder ? [...solves].reverse() : solves;

		// Calculate Best and Worst (excluding DNFs if possible, or handling them)
		// worst is usually max time.
		let bestTime = Infinity;
		let worstTime = -1;

		solves.forEach(s => {
			if (!s.dnf) {
				if (s.time < bestTime) bestTime = s.time;
				if (s.time > worstTime) worstTime = s.time;
			}
		});

		return (
			<div className={b({ mobile: true })}>
				<div className={b('mobile-header')}>
					<div className={b('mobile-header-top')}>
						<div className={b('mobile-title')}>İstatistik Detayı</div>
						<div className={b('mobile-done')} onClick={handleDone}>Bitti</div>
					</div>
					<div className={b('mobile-header-main')}>
						<div className={b('mobile-time')}>{timeString}</div>
						<div className={b('mobile-desc')}>
							<span>{description} {cubeTypes.join(', ')}</span>
						</div>
					</div>
				</div>

				<div className={b('mobile-actions')}>
					<Button
						large
						fullWidth
						iconFirst
						icon={<Copy weight="bold" />}
						text="Kopyala"
						theme={CommonType.PRIMARY}
						onClick={handleCopy}
					/>
					<Button
						large
						fullWidth
						iconFirst
						icon={<ShareNetwork weight="bold" />}
						text="Paylaş"
						theme={CommonType.PRIMARY}
						onClick={handleShare}
					/>
				</div>

				<div className={b('mobile-section-title')}>SÜRELER</div>
				<div className={b('mobile-solves')}>
					{displaySolves.map((solve, i) => {
						const displayIndex = reverseOrder ? i + 1 : solves.length - i;
						const time = getTimeString(solve);
						const isTrimmed = trimmedIds.has(solve.id);
						const date = new Date(solve.ended_at).toLocaleDateString();

						const isBest = !solve.dnf && solve.time === bestTime;
						const isWorst = !solve.dnf && solve.time === worstTime;

						return (
							<div key={solve.id} className={b('mobile-row')} onClick={() => openSolve(solve)} style={{ cursor: 'pointer' }}>
								<div className={b('mobile-row-header')}>
									<div className={b('mobile-row-index')}>{displayIndex}.</div>
									<div className={b('mobile-row-time', {
										trimmed: isTrimmed,
										dnf: solve.dnf,
										plusTwo: solve.plus_two,
										best: isBest,
										worst: isWorst
									})}>{displayTime(solve, isTrimmed)}</div>
									<div className={b('mobile-row-date')}>{date}</div>
								</div>
								<div className={b('mobile-row-scramble')}>
									{solve.scramble || 'Karıştırma verisi yok'}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	function displayTime(solve: Solve, isTrimmed: boolean) {
		const str = getTimeString(solve);
		return isTrimmed ? `(${str})` : str;
	}

	// showAsText modunda (ScrambleInfo'dan açıldığında) SolvesText göster
	if (showAsText) {
		return (
			<div className={b({ card: true })}>
				<div className={b('card-header')}>
					<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
						<div style={{ fontSize: '1rem', fontWeight: 600, color: '#4a9eff', cursor: 'pointer' }} onClick={handleDone}>Bitti</div>
					</div>
					<div className={b('card-time')}>{timeString}</div>
					<div className={b('card-desc')}>
						<span>{description}</span>
					</div>
				</div>
				<div className={b('body')}>
					<SolvesText reverseOrder={reverseOrder} description={description} time={effectiveTime} solves={solves} />
				</div>
			</div>
		);
	}

	// Web layout - kart tasarımı (mobil ile aynı stil)
	const displaySolves = reverseOrder ? [...solves].reverse() : solves;

	let bestTime = Infinity;
	let worstTime = -1;
	solves.forEach(s => {
		if (!s.dnf) {
			if (s.time < bestTime) bestTime = s.time;
			if (s.time > worstTime) worstTime = s.time;
		}
	});

	return (
		<div className={b({ card: true })}>
			<div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: 8 }}>
				<div style={{ fontSize: '1rem', fontWeight: 600, color: '#4a9eff', cursor: 'pointer' }} onClick={handleDone}>Bitti</div>
			</div>
			<div className={b('card-header')}>
				<div className={b('card-time')}>{timeString}</div>
				<div className={b('card-desc')}>
					<span>{description} {cubeTypes.join(', ')}</span>
				</div>
			</div>

			<div className={b('card-actions')}>
				<Button
					large
					fullWidth
					iconFirst
					icon={<Copy weight="bold" />}
					text="Kopyala"
					theme={CommonType.PRIMARY}
					onClick={handleCopy}
				/>
				<Button
					large
					fullWidth
					iconFirst
					icon={<ShareNetwork weight="bold" />}
					text="Paylaş"
					theme={CommonType.PRIMARY}
					onClick={handleShare}
				/>
			</div>

			<div className={b('card-section-title')}>SÜRELER</div>
			<div className={b('card-solves')}>
				{displaySolves.map((solve, i) => {
					const displayIndex = reverseOrder ? i + 1 : solves.length - i;
					const isTrimmed = trimmedIds.has(solve.id);
					const date = new Date(solve.ended_at).toLocaleDateString();
					const isBest = !solve.dnf && solve.time === bestTime;
					const isWorst = !solve.dnf && solve.time === worstTime;

					return (
						<div key={solve.id} className={b('mobile-row')} onClick={() => openSolve(solve)} style={{ cursor: 'pointer' }}>
							<div className={b('mobile-row-header')}>
								<div className={b('mobile-row-index')}>{displayIndex}.</div>
								<div className={b('mobile-row-time', {
									trimmed: isTrimmed,
									dnf: solve.dnf,
									plusTwo: solve.plus_two,
									best: isBest,
									worst: isWorst
								})}>{displayTime(solve, isTrimmed)}</div>
								<div className={b('mobile-row-date')}>{date}</div>
							</div>
							<div className={b('mobile-row-scramble')}>
								{solve.scramble || 'Karıştırma verisi yok'}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

