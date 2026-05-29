import React, {useRef, useEffect, useCallback} from 'react';
import block from '../../../styles/bem';
import './neon-auth.scss';

const b = block('neon-otp');

export type OtpStatus = 'idle' | 'verifying' | 'error' | 'success';

interface Props {
	value: string;
	onChange: (next: string) => void;
	onComplete?: (full: string) => void;
	length?: number;
	status?: OtpStatus;
	// bump to (re)focus the first empty box (e.g. after a reset or resend)
	focusKey?: number;
	// 'lg' desktop · 'md' mobile
	size?: 'lg' | 'md';
	ariaLabel?: string;
}

// Server codes are 6-char UPPERCASE alphanumeric (shared/code.ts → A-Z0-9),
// so the boxes accept letters + digits and normalise to upper case.
const NON_CODE = /[^0-9a-zA-Z]/g;

function collapse(arr: string[], length: number): string {
	return arr.join('').replace(NON_CODE, '').toUpperCase().slice(0, length);
}

/**
 * Neon glowing OTP input.
 * Robust entry: physical keyboard, soft keyboard (onChange), paste/autofill
 * (onPaste + multi-char onChange). Backspace/Arrow/Home/End navigation.
 * Animations are CSS-driven via data-state / data-status (see neon-auth.scss).
 */
export default function NeonOtpInput({
	value,
	onChange,
	onComplete,
	length = 6,
	status = 'idle',
	focusKey = 0,
	size = 'lg',
	ariaLabel,
}: Props) {
	const refs = useRef<Array<HTMLInputElement | null>>([]);
	const digits = Array.from({length}, (_, i) => value[i] || '');
	const firstEmpty = value.length < length ? value.length : length - 1;
	const locked = status === 'verifying' || status === 'success';

	// autofocus / refocus the first empty box
	useEffect(() => {
		if (locked) return;
		const el = refs.current[Math.min(value.length, length - 1)];
		el?.focus();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [focusKey]);

	const focusIdx = useCallback(
		(i: number) => {
			const t = Math.max(0, Math.min(length - 1, i));
			const el = refs.current[t];
			el?.focus();
			el?.select?.();
		},
		[length]
	);

	function commit(next: string) {
		const trimmed = next.slice(0, length);
		onChange(trimmed);
		if (trimmed.length === length) onComplete?.(trimmed);
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>, i: number) {
		if (locked) return;
		const chars = e.target.value.replace(NON_CODE, '').toUpperCase();
		if (!chars) return; // deletion is handled in onKeyDown

		const arr = digits.slice();
		// multi-char (paste/autofill landing in one box) fills forward from i
		let p = i;
		for (const c of chars) {
			if (p >= length) break;
			arr[p] = c;
			p++;
		}
		commit(collapse(arr, length));
		focusIdx(Math.min(p, length - 1));
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
		if (locked) {
			e.preventDefault();
			return;
		}
		const k = e.key;
		if (k === 'Backspace') {
			e.preventDefault();
			const arr = digits.slice();
			if (digits[i]) {
				arr[i] = '';
				onChange(collapse(arr, length));
			} else if (i > 0) {
				arr[i - 1] = '';
				onChange(collapse(arr, length));
				focusIdx(i - 1);
			}
			return;
		}
		if (k === 'ArrowLeft') {
			e.preventDefault();
			focusIdx(i - 1);
			return;
		}
		if (k === 'ArrowRight') {
			e.preventDefault();
			focusIdx(i + 1);
			return;
		}
		if (k === 'Home') {
			e.preventDefault();
			focusIdx(0);
			return;
		}
		if (k === 'End') {
			e.preventDefault();
			focusIdx(firstEmpty);
		}
	}

	function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
		if (locked) return;
		e.preventDefault();
		const chars = e.clipboardData.getData('text').replace(NON_CODE, '').toUpperCase().slice(0, length);
		if (!chars) return;
		commit(chars);
		focusIdx(Math.min(chars.length, length - 1));
	}

	const complete = value.length >= length || status === 'verifying';
	const gooId = `cd-neon-otp-goo-${size}`;

	return (
		<div className={b()} data-size={size} data-merge={complete ? 'true' : 'false'}>
			{/* gooey filter — merges adjacent neon outlines into one organic shape */}
			<svg className={b('goo')} aria-hidden="true" focusable="false">
				<defs>
					<filter id={gooId} x="-35%" y="-35%" width="170%" height="170%">
						<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
						<feColorMatrix
							in="blur"
							mode="matrix"
							values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -6"
							result="goo"
						/>
					</filter>
				</defs>
			</svg>

			<div className={b('row')} data-status={status}>
				{/* merge layer: one neon outline per filled slot, fused by the goo filter */}
				<div
					className={b('merge')}
					aria-hidden="true"
					style={{
						filter: `url(#${gooId}) drop-shadow(0 0 6px rgb(var(--neon-a))) drop-shadow(0 0 16px rgb(var(--neon-b)))`,
					}}
				>
					{digits.map((d, i) => (
						<span key={i} className={b('merge-cell')} data-on={d || status === 'verifying' ? 'true' : 'false'} />
					))}
				</div>

				{digits.map((d, i) => {
					const state =
						status === 'success'
							? 'success'
							: status === 'error'
							? 'error'
							: d
							? 'filled'
							: i === firstEmpty
							? 'active'
							: 'empty';
					return (
						<label key={i} className={b('box')} data-state={state} data-status={status}>
							<span className={b('ring')} aria-hidden="true" />
							<input
								ref={(el) => (refs.current[i] = el)}
								className={b('input')}
								type="text"
								inputMode="text"
								autoCapitalize="characters"
								autoComplete={i === 0 ? 'one-time-code' : 'off'}
								spellCheck={false}
								maxLength={1}
								value={d}
								disabled={locked}
								aria-label={`${ariaLabel || 'Code'} ${i + 1}`}
								onChange={(e) => handleChange(e, i)}
								onKeyDown={(e) => handleKeyDown(e, i)}
								onPaste={handlePaste}
								onFocus={(e) => e.target.select?.()}
							/>
							<span className={b('glyph')} key={d || 'empty'}>
								{d}
							</span>
							{state === 'active' && <span className={b('caret')} aria-hidden="true" />}
						</label>
					);
				})}
			</div>
		</div>
	);
}
