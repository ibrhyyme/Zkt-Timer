import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import './Session.scss';
import { getDateFromNow } from '../../../util/dates';
import { Session as SessionSchema } from '../../../../server/schemas/Session.schema';
import block from '../../../styles/bem';
import { reactState } from '../../../@types/react';
import { fetchSessionSummary } from '../../../db/solves/query';
import { getTimeString } from '../../../util/time';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { formatInteger } from '../../../util/locale_format';
import { getBucketShortLabel } from '../../../util/cubes/util';

const b = block('session-row');

const TYPES_HINT_MAX_WIDTH = 260;
const TYPES_HINT_EDGE = 8;

interface TypesHintPosition {
	left: number;
	width: number;
	top?: number;
	bottom?: number;
	/** Opened by a tap or click: stays when the mouse leaves */
	pinned: boolean;
}

function hasHoverPointer() {
	return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}

interface Props {
	setSelectedSessionId: reactState<string>;
	selectedSessionId: string;
	session: SessionSchema;
	selectSession: (e, id) => void;
	isMultiSelected?: boolean;
	/** Bulk delete mode: the row shows a check mark and a tap toggles it */
	selecting?: boolean;
}

export default function Session(props: Props) {
	const { t, i18n } = useTranslation();

	const { session, selectedSessionId, selectSession, isMultiSelected, selecting } = props;

	// The "N types" explanation used to be a title tooltip, which touch screens never show.
	// A tap or click opens it (a mouse also by hovering); a tap anywhere else, scrolling or
	// Escape closes it. It is rendered into <body> at a fixed position: the session list is
	// its own scroll box (on phones only as tall as its rows), which clipped a hint placed
	// under the chip inside the row.
	const [typesHint, setTypesHint] = useState<TypesHintPosition | null>(null);
	const typesRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!typesHint) return;
		const close = () => setTypesHint(null);
		const closeOutside = (e: Event) => {
			if (typesRef.current?.contains(e.target as Node)) return;
			close();
		};
		const closeOnEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('pointerdown', closeOutside, true);
		document.addEventListener('keydown', closeOnEscape);
		// Fixed position: it would stay behind while the list or the page moves
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		return () => {
			document.removeEventListener('pointerdown', closeOutside, true);
			document.removeEventListener('keydown', closeOnEscape);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
		};
	}, [typesHint]);

	function openTypesHint(pinned: boolean) {
		const chip = typesRef.current?.getBoundingClientRect();
		const card = rowRef.current?.getBoundingClientRect();
		if (!chip || !card) return;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const width = Math.min(TYPES_HINT_MAX_WIDTH, viewportWidth - 2 * TYPES_HINT_EDGE);
		const left = Math.max(TYPES_HINT_EDGE, Math.min(card.left, viewportWidth - width - TYPES_HINT_EDGE));
		// Under the chip, or above it when the chip sits low on the screen
		const below = chip.bottom < viewportHeight * 0.65;
		setTypesHint({
			left,
			width,
			pinned,
			...(below ? { top: chip.bottom + 6 } : { bottom: viewportHeight - chip.top + 6 }),
		});
	}

	const sessionIsSelected = selectedSessionId === session.id;

	// A session row used to show only its name and creation date. What you
	// actually need when choosing one is how much is in it and how it is going,
	// so the row now carries count, best and mean.
	//
	// Recomputed whenever the local solve DB changes, or the numbers go stale the moment
	// a solve is added or deleted. solveDbUpdatedEvent goes through the app's own emitter
	// (util/event_handler), never `window`, so the counter DataProvider derives from it
	// is the subscription; a window listener here never fired.
	const solveDbChange = useSolveDb();
	const summary = React.useMemo(
		() => fetchSessionSummary(session.id),
		[session.id, solveDbChange]
	);

	// Several types: best and mean belong to the most solved one, so the row names it (K-13)
	const topLabel =
		summary.bucketCount > 1 && summary.topBucket
			? getBucketShortLabel(summary.topBucket.cube_type, summary.topBucket.scramble_subset)
			: null;

	return (
		<div
			key={session.id}
			ref={rowRef}
			className={b({ selected: sessionIsSelected, 'multi-selected': isMultiSelected, selecting })}
			onPointerDown={(e) => selectSession(e, session.id)}
		>
			{selecting && (
				<span className={b('check', { on: !!isMultiSelected })} aria-hidden="true">
					{isMultiSelected && <Check weight="bold" />}
				</span>
			)}
			<div className={b('info')}>
				<h4>{session.name}</h4>
				<span className={b('created-at')}>{t('sessions.created')} {getDateFromNow(session.created_at)}</span>
				<div className={b('summary')}>
					<span className={b('summary-item')}>
						{t('sessions.solve_count', {count: summary.count, countText: formatInteger(summary.count, i18n.language)})}
					</span>
					{/* Each cube type keeps its own list on the timer, so a session with several
					    reads as one list that "restarts" when the type changes (2.7-a). */}
					{summary.bucketCount > 1 && (
						<div
							ref={typesRef}
							className={b('types')}
							// The chip must not select the row (or toggle it in bulk delete mode)
							onPointerDown={(e) => e.stopPropagation()}
							onMouseEnter={() => {
								if (!typesHint && hasHoverPointer()) openTypesHint(false);
							}}
							onMouseLeave={() => {
								if (typesHint && !typesHint.pinned) setTypesHint(null);
							}}
						>
							<button
								type="button"
								className={b('summary-item', { types: true })}
								aria-expanded={!!typesHint}
								onClick={(e) => {
									e.stopPropagation();
									if (typesHint?.pinned) setTypesHint(null);
									else openTypesHint(true);
								}}
							>
								{t('sessions.types_count', {count: summary.bucketCount})}
							</button>
							{typesHint &&
								ReactDOM.createPortal(
									<div
										role="tooltip"
										className={b('types-hint')}
										style={{
											left: typesHint.left,
											width: typesHint.width,
											top: typesHint.top,
											bottom: typesHint.bottom,
										}}
									>
										{t('sessions.types_count_hint', {count: summary.bucketCount})}
									</div>,
									document.body
								)}
						</div>
					)}
					{topLabel && (summary.best !== null || summary.average !== null) && (
						<span className={b('summary-item', { 'top-type': true })}>{topLabel}</span>
					)}
					{summary.best !== null && (
						<span className={b('summary-item')}>
							<em>{t('sessions.best_short')}</em> {getTimeString(summary.best)}
						</span>
					)}
					{summary.average !== null && (
						<span className={b('summary-item')}>
							<em>{t('sessions.mean_short')}</em> {getTimeString(summary.average)}
						</span>
					)}
				</div>
				<span className={b('drag-hint')}>{t('sessions.drag_to_reorder')}</span>
			</div>
		</div>
	);
}
