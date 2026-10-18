/**
 * card_view: what one card of the hub or the Trainers page shows, already translated. The desktop
 * grid (LandingCard) and the mobile stack (CardStack) draw the same list, so the two layouts can
 * never list different trainers or texts.
 */
import type React from 'react';
import type {Icon} from 'phosphor-react';
import type {ModeAccent} from '../landing_modes';

export interface CardItem {
	text: string;
	/** Own icon and colour (the Trainers card lists each trainer); a check mark otherwise. */
	Icon?: Icon;
	accent?: ModeAccent;
	/** "Pro" badge after the text. */
	pro?: boolean;
}

export interface CardView {
	id: string;
	Icon: Icon;
	accent: ModeAccent;
	/** Small label in the top row ("Admin"). */
	eyebrow?: string | null;
	title: string;
	desc: string;
	groupLabel?: string | null;
	items: CardItem[];
	onSelect: () => void;
	/** Button text; the card's name when absent (the trainer cards). */
	ctaLabel?: string;
	/** Live lines under the list (the Battle hub's rating and queue count). */
	footer?: React.ReactNode;
	/** Shown but not openable (Online Battle without a connection): no button, no click. */
	disabled?: boolean;
}
