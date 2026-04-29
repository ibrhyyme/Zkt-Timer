type ScrollHandler = (scrollTop: number) => void;

const channels = new Map<string, Set<ScrollHandler>>();

export function subscribeScroll(channel: string, handler: ScrollHandler): () => void {
	if (!channels.has(channel)) channels.set(channel, new Set());
	channels.get(channel)!.add(handler);
	return () => channels.get(channel)?.delete(handler);
}

export function publishScroll(channel: string, scrollTop: number) {
	channels.get(channel)?.forEach((h) => h(scrollTop));
}

export const HISTORY_SCROLL_CHANNEL = 'history_scroll';
export const PHASE_ANALYSIS_SCROLL_CHANNEL = 'phase_analysis_scroll';
