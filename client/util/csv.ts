/**
 * CSV text for files people open in a spreadsheet.
 *
 * Cells that start with =, +, -, @, tab or carriage return are run as formulas by Excel and
 * Sheets, so a cube name like `=HYPERLINK(...)` would execute on the reader's machine. Such
 * strings get a leading apostrophe (OWASP's recommendation). Only strings are guarded: a real
 * negative number stays a number.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
	if (v === null || v === undefined) return '';
	let s = String(v);
	if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
	// Quote anything a spreadsheet would otherwise split or mangle.
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The BOM makes Excel read the file as UTF-8, so Turkish letters in names survive. */
export function buildCsv(headers: string[], rows: unknown[][]): string {
	const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','));
	return `﻿${lines.join('\r\n')}`;
}

export const CSV_MIME = 'text/csv;charset=utf-8';
