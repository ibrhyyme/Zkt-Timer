/**
 * CardStack: the phone layout of the hub and the Trainers page. The same cards as the desktop
 * grid (LandingCard), full width, one under the other.
 *
 * - `overlap` (Trainers page): like cards in a wallet. Every card but the last shows only its
 *   head (top row, name, description) and the next card slides over its bottom edge; the last
 *   card is open with its list and button. Every head stays readable, a tap anywhere on a card
 *   opens that trainer.
 * - without `overlap` (hub): separate cards, each fully open.
 *
 * No line clamp anywhere: a long language adds a line instead of being cut.
 */
import React from 'react';
import block from '../../../styles/bem';
import LandingCard from './LandingCard';
import type {CardView} from './card_view';
import './CardStack.scss';

const b = block('trainer-stack');

interface Props {
	cards: CardView[];
	overlap?: boolean;
}

export default function CardStack({cards, overlap = false}: Props) {
	const last = cards.length - 1;
	return (
		<div className={b({overlap})}>
			{cards.map((card, i) => (
				<LandingCard
					key={card.id}
					card={card}
					collapsed={overlap && i !== last}
					className={b('card').toString()}
					style={overlap ? {zIndex: i + 1} : undefined}
				/>
			))}
		</div>
	);
}
