export function formatAccuracy(ratio: number): string {
	return (ratio * 100).toFixed(1) + '%';
}

export function formatDate(date: Date | string | number): string {
	return new Date(date).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function sessionTypeKey(s: {poolKey: string; sizeOption: number}): string {
	return `${s.poolKey}|${s.sizeOption}`;
}
