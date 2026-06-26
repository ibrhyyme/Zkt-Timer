import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactList from 'react-list';
import { GlobalHotKeys } from 'react-hotkeys';
import './History.scss';
import Empty from '../../common/empty/Empty';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import { FilterSolvesOptions, fetchSolves, fetchLastSolve } from '../../../db/solves/query';
import HistorySolveRow from './solve_row/HistorySolveRow';
import { toggleDnfSolveDb, togglePlusTwoSolveDb, setOkSolveDb } from '../../../db/solves/operations';
import { deleteSolveDb } from '../../../db/solves/update';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { Solve } from '../../../../server/schemas/Solve.schema';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useSettings } from '../../../util/hooks/useSettings';
import { publishScroll, subscribeScroll, HISTORY_SCROLL_CHANNEL, PHASE_ANALYSIS_SCROLL_CHANNEL } from '../../../util/scroll_sync';

interface Props {
	solves?: Solve[];
	filterOptions?: FilterSolvesOptions;
	disabled?: boolean;
	reverseOrder?: boolean;
	hotKeysEnabled?: boolean;
}

// TODO NOW hotkeys for History
export default function History(props: Props) {
	const { solves: parentSolves, reverseOrder, disabled, filterOptions, hotKeysEnabled } = props;

	const { t } = useTranslation();
	useSolveDb();
	const modals = useGeneral('modals');
	const scrollRef = useRef<HTMLDivElement>(null);
	const isReceiving = useRef(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const onScroll = () => {
			if (!isReceiving.current) {
				publishScroll(HISTORY_SCROLL_CHANNEL, el.scrollTop);
			}
		};

		el.addEventListener('scroll', onScroll, { passive: true });

		const unsub = subscribeScroll(PHASE_ANALYSIS_SCROLL_CHANNEL, (top) => {
			isReceiving.current = true;
			el.scrollTop = top;
			requestAnimationFrame(() => { isReceiving.current = false; });
		});

		return () => {
			el.removeEventListener('scroll', onScroll);
			unsub();
		};
	}, []);

	let solves;
	if (parentSolves) {
		solves = parentSolves;
	} else {
		solves = fetchSolves(filterOptions);
	}

	// PB highlight: mark only the all-time best (real PB) solve per (cube_type,
	// scramble_subset) bucket. Computed over the FULL history rather than the limited
	// on-screen window, so a non-record time is never flagged just because it happens
	// to be the fastest of the currently visible page.
	const highlightPbs = useSettings('highlight_pbs');
	const pbSolveIds = React.useMemo(() => {
		const ids = new Set<string>();
		if (highlightPbs === 'off') return ids;

		// Use the unbounded history when we own the query; fall back to provided solves.
		const source = filterOptions
			? fetchSolves({ ...filterOptions, limit: undefined })
			: (parentSolves || solves);

		const bestByBucket = new Map<string, { time: number; id: string }>();
		for (const s of source) {
			if (s.dnf) continue;
			const t = s.time + (s.plus_two ? 2 : 0);
			if (t <= 0) continue;
			const key = `${s.cube_type}::${s.scramble_subset || ''}`;
			const cur = bestByBucket.get(key);
			if (!cur || t < cur.time) {
				bestByBucket.set(key, { time: t, id: s.id });
			}
		}
		for (const { id } of bestByBucket.values()) {
			ids.add(id);
		}
		return ids;
	}, [solves, parentSolves, filterOptions, highlightPbs]);

	function renderSolveRow(index: number) {
		let solveIndex = index;
		if (reverseOrder) {
			solveIndex = solves.length - index - 1;
		}

		let displayIndex = solves.length - index - 1;
		if (reverseOrder) {
			displayIndex = index;
		}

		const solve = solves[solveIndex];
		return <HistorySolveRow disabled={disabled} key={solve.id} index={displayIndex} solve={solve} isPb={pbSolveIds.has(solve.id)} highlightMode={highlightPbs} />;
	}

	function getLastSolve() {
		return fetchLastSolve(filterOptions);
	}

	// allow hotkey actions only when explicitly enabled and no any modal windows active
	function isHotKeysEnabled() {
		return hotKeysEnabled && (!modals || modals.length == 0);
	}

	function okLastSolve() {
		if (isHotKeysEnabled()) setOkSolveDb(getLastSolve());
	}

	function dnfLastSolve() {
		if (isHotKeysEnabled()) toggleDnfSolveDb(getLastSolve());
	}

	function plusTwoLastSolve() {
		if (isHotKeysEnabled()) togglePlusTwoSolveDb(getLastSolve());
	}

	function deleteLastSolve() {
		if (isHotKeysEnabled()) deleteSolveDb(getLastSolve());
	}

	if (!solves.length) {
		return (
			<div className="cd-history">
				<Empty text={t('timer_modules.no_solves_yet')} />
			</div>
		);
	}

	const HOTKEY_HANDLERS = {
		TOGGLE_OK: okLastSolve,
		TOGGLE_DNF: dnfLastSolve,
		DELETE_LAST_TIME: deleteLastSolve,
		TOGGLE_PLUS_TWO: plusTwoLastSolve,
	};

	return (
		<GlobalHotKeys handlers={HOTKEY_HANDLERS} keyMap={HOTKEY_MAP}>
			<div className="cd-history h-full">
				<div className="cd-history__table h-full">
					<div ref={scrollRef} className="cd-history__list h-full overflow-y-auto">
						<ReactList itemRenderer={renderSolveRow} length={solves.length} type="uniform" />
					</div>
				</div>
			</div>
		</GlobalHotKeys>
	);
}
