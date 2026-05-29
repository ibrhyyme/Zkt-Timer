/**
 * Note — per-case user note, Shift+N hotkey (enableHotkeys=true).
 * Fully prop-driven (no Provider access) — works even inside
 * CaseVariationsModal mounted via openModal.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import block from '../../../../styles/bem';
import {Pencil} from 'phosphor-react';
import {useKeydown} from '../hooks/useKeydown';

const b = block('trainer-recognition');

const NOTE_HOTKEY = 'N';

interface NoteProps {
	value: string;
	onChange: (next: string) => void;
	enableHotkeys?: boolean;
	addLabel?: string;
	editLabel?: string;
	saveHint?: string;
}

export default function Note({value, onChange, enableHotkeys = false, addLabel, editLabel, saveHint}: NoteProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!isEditing) setDraft(value);
	}, [value, isEditing]);

	const startEditing = useCallback(() => {
		setDraft(value);
		setIsEditing(true);
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus();
				inputRef.current.select();
			}
		}, 0);
	}, [value]);

	const commit = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed !== value) onChange(trimmed);
		setIsEditing(false);
	}, [draft, value, onChange]);

	const cancel = useCallback(() => {
		setDraft(value);
		setIsEditing(false);
	}, [value]);

	const inputKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				commit();
				e.stopPropagation();
				e.preventDefault();
			} else if (e.key === 'Escape') {
				cancel();
				e.stopPropagation();
				e.preventDefault();
			}
		},
		[commit, cancel]
	);

	const componentKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (isEditing) return;
			if (e.key === NOTE_HOTKEY && e.shiftKey) {
				startEditing();
				e.stopPropagation();
				e.preventDefault();
			}
		},
		[isEditing, startEditing]
	);

	useEffect(() => {
		if (!enableHotkeys) return;
		if (typeof window === 'undefined') return;
		window.addEventListener('keydown', componentKeyDown);
		return () => window.removeEventListener('keydown', componentKeyDown);
	}, [enableHotkeys, componentKeyDown]);

	if (isEditing) {
		return (
			<div className={b('note')}>
				<input
					ref={inputRef}
					type="text"
					maxLength={200}
					className={`noteInput ${b('note-input')}`}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={inputKeyDown}
					onBlur={commit}
				/>
				{saveHint && <div className={b('note-hint')}>{saveHint}</div>}
			</div>
		);
	}

	if (value) {
		return (
			<div className={b('note')}>
				<div className={b('note-display')} title={editLabel} onClick={startEditing}>
					<span>{value}</span>
					<Pencil className={b('note-edit-icon')} />
				</div>
			</div>
		);
	}

	return (
		<button onClick={startEditing} className={b('note-add')} type="button">
			{addLabel || 'Add note'}
			{enableHotkeys && <span className={b('note-hotkey-hint')}> (shift+{NOTE_HOTKEY})</span>}
		</button>
	);
}
