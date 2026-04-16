import React, {useState, useEffect, useRef} from 'react';
import {b} from './shared';

interface Props {
	value: number | null | undefined; // centiseconds; -1=DNF, -2=DNS
	onChange: (cs: number | null) => void;
	placeholder?: string;
	disabled?: boolean;
}

const DNF = -1;
const DNS = -2;

/**
 * Convert centiseconds -> display string "HH:MM:SS.CC" with leading zeros stripped.
 * Handles DNF/DNS as special strings.
 */
function csToDisplay(cs: number | null | undefined): string {
	if (cs === DNF) return 'DNF';
	if (cs === DNS) return 'DNS';
	if (cs === null || cs === undefined || cs <= 0) return '';

	// Build from raw digits for consistency
	const total = cs; // centiseconds
	const cc = total % 100;
	const ss = Math.floor(total / 100) % 60;
	const mm = Math.floor(total / 6000) % 60;
	const hh = Math.floor(total / 360000);

	let s = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
	// Strip leading zeros and colons (like WCA TimeField)
	s = s.replace(/^[0:]*(?!\.)/g, '');
	if (s.startsWith('.')) s = '0' + s;
	return s;
}

/**
 * Parse a digit-sequence into centiseconds using WCA-style positional reformatting.
 * Input: any number of digits, e.g. "12345" -> 01:23.45 (12345 cs)
 * Returns centiseconds or null for invalid.
 */
function digitsToCs(digits: string): number | null {
	if (!digits) return null;
	const n = parseInt(digits.slice(-8), 10) || 0;
	if (n === 0) return null;
	const str = String(n).padStart(8, '0');
	const hh = parseInt(str.slice(0, 2), 10);
	const mm = parseInt(str.slice(2, 4), 10);
	const ss = parseInt(str.slice(4, 6), 10);
	const cc = parseInt(str.slice(6, 8), 10);
	// Validate: seconds < 60, minutes < 60
	if (ss >= 60 || mm >= 60) return null;
	return hh * 360000 + mm * 6000 + ss * 100 + cc;
}

/**
 * Reformat raw input (may include colons/dots/spaces) into clean HH:MM:SS.CC display.
 */
function reformatInput(raw: string): string {
	const upper = raw.trim().toUpperCase();
	if (upper === 'DNF' || upper === 'DNS') return upper;

	const digits = upper.replace(/\D/g, '').slice(-8);
	if (!digits) return '';

	const cs = digitsToCs(digits);
	if (cs === null) return upper; // keep user input if invalid
	return csToDisplay(cs);
}

export default function TimeField(props: Props) {
	const {value, onChange, placeholder, disabled} = props;
	const [draft, setDraft] = useState<string>(csToDisplay(value));
	const lastValueRef = useRef<number | null | undefined>(value);

	// Sync draft when value changes externally
	useEffect(() => {
		if (value !== lastValueRef.current) {
			setDraft(csToDisplay(value));
			lastValueRef.current = value;
		}
	}, [value]);

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const raw = e.target.value;
		const upper = raw.trim().toUpperCase();

		// Special keys: D/F -> DNF, S -> DNS
		if (upper === 'D' || upper === 'F' || upper === 'DF' || upper === 'DNF') {
			setDraft('DNF');
			if (value !== DNF) {
				lastValueRef.current = DNF;
				onChange(DNF);
			}
			return;
		}
		if (upper === 'S' || upper === 'DNS') {
			setDraft('DNS');
			if (value !== DNS) {
				lastValueRef.current = DNS;
				onChange(DNS);
			}
			return;
		}

		const formatted = reformatInput(raw);
		setDraft(formatted);

		// Parse to centiseconds
		const digits = upper.replace(/\D/g, '');
		const cs = digitsToCs(digits);
		if (cs !== value) {
			lastValueRef.current = cs;
			onChange(cs);
		}
	}

	function handleBlur() {
		// Canonicalize on blur
		if (draft === 'DNF' || draft === 'DNS') return;
		const digits = draft.replace(/\D/g, '');
		const cs = digitsToCs(digits);
		const canonical = csToDisplay(cs);
		setDraft(canonical);
		if (cs !== value) {
			lastValueRef.current = cs;
			onChange(cs);
		}
	}

	const isSpecial = draft === 'DNF' || draft === 'DNS';

	return (
		<input
			type="text"
			className={b('time-field-input', {special: isSpecial})}
			value={draft}
			onChange={handleChange}
			onBlur={handleBlur}
			placeholder={placeholder || '0.00'}
			disabled={disabled}
			inputMode="decimal"
			autoComplete="off"
		/>
	);
}
