import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ArrowUUpLeft} from 'phosphor-react';
import block from '../../../styles/bem';
import './MessageBubble.scss';

const b = block('msg-bubble');

// Movement past this to the right counts as a reply gesture.
const REPLY_THRESHOLD = 56;
const DRAG_SLOP = 6;
const VERTICAL_GUARD = 12;
// Beyond this the bubble stops following the finger, so the gesture feels bounded.
const MAX_PULL = 84;

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
	mine: boolean;
	reactions: {user_id: string; emoji: string}[];
	myUserId?: string;
	onReply: () => void;
	onReact: (emoji: string) => void;
	/** Opens the owner-only actions (edit, unsend). */
	onSelect: () => void;
	children: React.ReactNode;
}

/**
 * One message, with the two gestures every messenger has trained people to expect.
 *
 * Drag right to reply, the same direction WhatsApp uses. Double click does the same on
 * a desktop, where dragging a bubble is not something anyone thinks to try. The
 * reaction bar appears on hover or on a long press, because a phone has no hover and a
 * mouse has no long press.
 */
export default function MessageBubble({mine, reactions, myUserId, onReply, onReact, onSelect, children}: Props) {
	const {t} = useTranslation();

	const [offset, setOffset] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [barOpen, setBarOpen] = useState(false);

	const draggingRef = useRef(false);
	const start = useRef({x: 0, y: 0});
	const moved = useRef(false);
	const axis = useRef<'x' | 'y' | null>(null);
	const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

	const mine_reaction = reactions.find((r) => r.user_id === myUserId)?.emoji;

	// Grouped for display: one chip per emoji with a count, not one chip per person.
	const grouped = reactions.reduce<Record<string, number>>((acc, r) => {
		acc[r.emoji] = (acc[r.emoji] || 0) + 1;
		return acc;
	}, {});

	function clearLongPress() {
		if (longPress.current) {
			clearTimeout(longPress.current);
			longPress.current = null;
		}
	}

	function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		if (e.button !== 0) return;
		start.current = {x: e.clientX, y: e.clientY};
		moved.current = false;
		axis.current = null;
		draggingRef.current = true;
		setDragging(true);

		// Touch has no hover, so holding still is how the reaction bar is reached.
		if (e.pointerType === 'touch') {
			clearLongPress();
			longPress.current = setTimeout(() => {
				if (!moved.current) setBarOpen(true);
			}, 420);
		}
	}

	function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return;

		const dx = e.clientX - start.current.x;
		const dy = e.clientY - start.current.y;

		if (!axis.current) {
			if (Math.abs(dy) > VERTICAL_GUARD && Math.abs(dy) > Math.abs(dx)) {
				axis.current = 'y';
				draggingRef.current = false;
				setDragging(false);
				clearLongPress();
				setOffset(0);
				return;
			}
			if (Math.abs(dx) > DRAG_SLOP) axis.current = 'x';
		}
		if (axis.current !== 'x') return;

		moved.current = true;
		clearLongPress();
		// Right only: pulling left has no meaning and would fight the swipe-to-act
		// gesture people use on the conversation list.
		setOffset(Math.max(0, Math.min(MAX_PULL, dx)));
	}

	function endDrag() {
		clearLongPress();
		if (!draggingRef.current && axis.current !== 'x') {
			draggingRef.current = false;
			setDragging(false);
			return;
		}
		draggingRef.current = false;
		setDragging(false);

		if (offset >= REPLY_THRESHOLD) onReply();
		setOffset(0);
	}

	return (
		<div
			className={b({mine})}
			onMouseEnter={() => setBarOpen(true)}
			onMouseLeave={() => setBarOpen(false)}
		>
			{barOpen && (
				<div className={b('bar')}>
					{REACTIONS.map((emoji) => (
						<button
							key={emoji}
							type="button"
							className={b('bar-emoji', {active: mine_reaction === emoji})}
							title={emoji}
							onClick={(e) => {
								e.stopPropagation();
								setBarOpen(false);
								onReact(emoji);
							}}
						>
							{emoji}
						</button>
					))}
					<button
						type="button"
						className={b('bar-reply')}
						title={t('messages.reply')}
						aria-label={t('messages.reply')}
						onClick={(e) => {
							e.stopPropagation();
							setBarOpen(false);
							onReply();
						}}
					>
						<ArrowUUpLeft weight="bold" />
					</button>
				</div>
			)}

			{/* The arrow that appears from under the bubble as it is pulled across. */}
			<span className={b('reply-hint', {armed: offset >= REPLY_THRESHOLD})} aria-hidden="true">
				<ArrowUUpLeft weight="bold" />
			</span>

			<div
				className={b('body', {dragging})}
				style={{transform: `translateX(${offset}px)`}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onDoubleClick={onReply}
				onClick={(e) => {
					if (moved.current) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					onSelect();
				}}
			>
				{children}
			</div>

			{Object.keys(grouped).length > 0 && (
				<div className={b('reactions')}>
					{Object.entries(grouped).map(([emoji, count]) => (
						<button
							key={emoji}
							type="button"
							className={b('reaction', {mine: mine_reaction === emoji})}
							onClick={(e) => {
								e.stopPropagation();
								onReact(emoji);
							}}
						>
							<span>{emoji}</span>
							{count > 1 && <span className={b('reaction-count')}>{count}</span>}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
