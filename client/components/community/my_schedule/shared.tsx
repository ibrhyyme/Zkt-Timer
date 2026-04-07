import React from 'react';
import block from '../../../styles/bem';

export const b = block('my-schedule');

export const I18N_LOCALE_MAP: Record<string, string> = {
	tr: 'tr-TR',
	en: 'en-US',
	es: 'es-ES',
	ru: 'ru-RU',
};

export const ROLE_COLORS: Record<string, string> = {
	competitor: 'primary',
	'staff-judge': 'orange',
	'staff-scrambler': 'purple',
	'staff-runner': 'blue',
	'staff-dataentry': 'gray',
	'staff-announcer': 'gray',
};

export function formatTime(isoString: string, locale: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'});
}

export function formatDayHeader(dateStr: string, locale: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return date.toLocaleDateString(locale, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
}

export function formatDateRange(startDate: string, endDate: string, locale: string): string {
	const start = new Date(startDate + 'T00:00:00');
	const end = new Date(endDate + 'T00:00:00');
	const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, opts);

	if (startDate === endDate) {
		return fmt(start, {day: 'numeric', month: 'short', year: 'numeric'});
	}
	return `${fmt(start, {day: 'numeric', month: 'short'})} - ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}`;
}

export function formatWcaTime(centiseconds: number): string {
	if (centiseconds === -1) return 'DNF';
	if (centiseconds === -2) return 'DNS';
	if (!centiseconds || centiseconds <= 0) return '\u2014';
	const minutes = Math.floor(centiseconds / 6000);
	const seconds = Math.floor((centiseconds % 6000) / 100);
	const cs = centiseconds % 100;
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
	}
	return `${seconds}.${cs.toString().padStart(2, '0')}`;
}

export function formatAttempts(attempts: {result: number}[], numberOfAttempts: number, eventId?: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < numberOfAttempts; i++) {
		out.push(attempts[i] ? formatResult(attempts[i].result, eventId, false) : '\u2014');
	}
	return out;
}

// MBLD (3x3 Multi-Blind) decoded: result encoding
// (99 - solved + missed) * 10000000 + centiseconds * 100 + missed
// Format: "{solved}/{attempted} HH:MM:SS"
export function formatMbldResult(result: number): string {
	if (result === -1) return 'DNF';
	if (result === -2) return 'DNS';
	if (!result || result <= 0) return '\u2014';

	const missed = result % 100;
	const seconds = Math.floor(result / 100) % 100000;
	const points = 99 - Math.floor(result / 10000000);
	const solved = points + missed;
	const attempted = solved + missed;

	// HH:MM:SS or MM:SS
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	const timeStr = h > 0
		? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
		: `${m}:${s.toString().padStart(2, '0')}`;

	return `${solved}/${attempted} ${timeStr}`;
}

// FMC (3x3 Fewest Moves): singles = integer move count, averages = scaled by 100 (2 decimal)
export function formatFmcResult(result: number, isAverage: boolean): string {
	if (result === -1) return 'DNF';
	if (result === -2) return 'DNS';
	if (!result || result <= 0) return '\u2014';
	if (isAverage) return (result / 100).toFixed(2);
	return String(result);
}

// Event-aware result formatter — herhangi bir event icin dogru formatla
export function formatResult(result: number, eventId?: string, isAverage: boolean = false): string {
	if (eventId === '333mbf') return formatMbldResult(result);
	if (eventId === '333fm') return formatFmcResult(result, isAverage);
	return formatWcaTime(result);
}

// ISO2 ulke kodu → flag emoji (orn 'TR' → '🇹🇷')
export function countryFlag(iso2: string | null | undefined): string {
	if (!iso2 || iso2.length !== 2) return '';
	try {
		return iso2
			.toUpperCase()
			.split('')
			.map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)))
			.join('');
	} catch {
		return '';
	}
}

// "5 saniye once", "2 dakika once", "1 saat once", "3 gun once"
export function formatTimeAgo(timestamp: number, t: any): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 5) return t('my_schedule.updated_just_now');
	if (seconds < 60) return t('my_schedule.updated_x_ago', {value: t('my_schedule.seconds_ago', {count: seconds})});
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return t('my_schedule.updated_x_ago', {value: t('my_schedule.minutes_ago', {count: minutes})});
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return t('my_schedule.updated_x_ago', {value: t('my_schedule.hours_ago', {count: hours})});
	const days = Math.floor(hours / 24);
	return t('my_schedule.updated_x_ago', {value: t('my_schedule.days_ago', {count: days})});
}

// Top 3 medal emoji
export function rankingMedal(ranking: number | null | undefined): string {
	if (ranking === 1) return '🥇';
	if (ranking === 2) return '🥈';
	if (ranking === 3) return '🥉';
	return '';
}

const RECORD_TAG_BG: Record<string, string> = {
	WR: 'rgba(231, 76, 60, 0.9)',
	CR: 'rgba(243, 156, 18, 0.9)',
	NR: 'rgba(39, 174, 96, 0.9)',
	PR: 'rgba(0, 0, 0, 0.6)',
};

export function RecordTag({tag}: {tag: string | null | undefined}) {
	if (!tag) return null;
	return (
		<sup className="cd-record-tag" style={{
			display: 'inline-block',
			background: RECORD_TAG_BG[tag] || 'rgba(0,0,0,0.6)',
			color: '#fff',
			fontWeight: 700,
			fontSize: '0.55rem',
			lineHeight: 1,
			padding: '0.15rem 0.25rem',
			borderRadius: '0.2rem',
			marginLeft: '0.25rem',
			verticalAlign: 'super',
			textTransform: 'uppercase',
			letterSpacing: '0.02em',
		}}>{tag}</sup>
	);
}

const WCA_EVENTS_MAP: Record<string, string> = {
	'333': '3x3x3',
	'222': '2x2x2',
	'444': '4x4x4',
	'555': '5x5x5',
	'666': '6x6x6',
	'777': '7x7x7',
	'333bf': '3x3 BLD',
	'333fm': '3x3 FMC',
	'333oh': '3x3 OH',
	clock: 'Clock',
	minx: 'Megaminx',
	pyram: 'Pyraminx',
	skewb: 'Skewb',
	sq1: 'Square-1',
	'444bf': '4x4 BLD',
	'555bf': '5x5 BLD',
	'333mbf': '3x3 MBLD',
};

export function getEventShortName(eventId: string): string {
	return WCA_EVENTS_MAP[eventId] || eventId;
}

export function EventIcon({eventId, size = 16}: {eventId: string; size?: number}) {
	return <span className={`cubing-icon event-${eventId}`} style={{fontSize: `${size}px`}} title={getEventShortName(eventId)} />;
}

export function getRoleLabel(assignmentCode: string, t: any): string {
	const roleMap: Record<string, string> = {
		competitor: t('my_schedule.role_competitor'),
		'staff-judge': t('my_schedule.role_judge'),
		'staff-scrambler': t('my_schedule.role_scrambler'),
		'staff-runner': t('my_schedule.role_runner'),
		'staff-dataentry': t('my_schedule.role_staff'),
		'staff-announcer': t('my_schedule.role_staff'),
	};
	return roleMap[assignmentCode] || assignmentCode;
}

export function parseActivityCodeLabel(activityCode: string): string {
	const match = activityCode.match(/^(\w+)-r(\d+)(?:-g(\d+))?(?:-a(\d+))?$/);
	if (!match) return activityCode;
	const eventName = getEventShortName(match[1]);
	const round = match[2];
	const group = match[3];
	let label = `${eventName} R${round}`;
	if (group) label += ` G${group}`;
	return label;
}

export function parseActivityCodeParts(activityCode: string): {eventId: string; roundNumber: number; groupNumber: number | null} | null {
	const match = activityCode.match(/^(\w+)-r(\d+)(?:-g(\d+))?(?:-a(\d+))?$/);
	if (!match) return null;
	return {
		eventId: match[1],
		roundNumber: parseInt(match[2], 10),
		groupNumber: match[3] ? parseInt(match[3], 10) : null,
	};
}

const FORMAT_MAP: Record<string, string> = {
	a: 'Ao5',
	m: 'Mo3',
	'1': 'Bo1',
	'2': 'Bo2',
	'3': 'Bo3',
};

export function formatRoundFormat(format: string): string {
	return FORMAT_MAP[format] || format;
}

