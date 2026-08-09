/**
 * Asking the floating chat stack to open a conversation.
 *
 * ChatBubbles lives in Wrapper, so it is a sibling of everything that wants to talk to
 * it rather than an ancestor. A window event is the cheapest honest channel between
 * them: no context provider wrapping the whole app for one feature, and no shared
 * store slice for state that is already local to one component.
 */
export const OPEN_CHAT_BUBBLE_EVENT = 'zkt:open-chat-bubble';

export interface OpenChatBubbleDetail {
	/** Absent when the two have never spoken: the thread is created on first send. */
	conversationId?: string | null;
	userId: string;
	username: string;
	/** The full public user, so the bubble draws the same avatar as everywhere else. */
	user?: any;
}

export function openChatBubble(detail: OpenChatBubbleDetail) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(OPEN_CHAT_BUBBLE_EVENT, {detail}));
}

/**
 * Whether floating bubbles are usable at all right now.
 *
 * On a phone the stack gives way to the full screen messages page, so callers there
 * should navigate instead of opening a window the user would have to fight with.
 */
export function bubblesAvailable(): boolean {
	return typeof window !== 'undefined' && window.innerWidth > 768;
}
