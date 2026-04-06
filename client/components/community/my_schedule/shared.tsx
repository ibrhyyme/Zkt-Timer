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
	if (!centiseconds) return '\u2014';
	const minutes = Math.floor(centiseconds / 6000);
	const seconds = Math.floor((centiseconds % 6000) / 100);
	const cs = centiseconds % 100;
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
	}
	return `${seconds}.${cs.toString().padStart(2, '0')}`;
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

