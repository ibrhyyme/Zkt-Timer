// Section navigation for the help page. One list serves both layouts, the way
// AccountNav does: a sticky sidebar on desktop, a horizontal strip on mobile.
//
// Nothing here routes — every section lives on the same page, so a click scrolls
// and the URL hash follows, which keeps `/help#smart-cube` shareable.

import React, {useEffect, useRef} from 'react';
import {motion} from 'framer-motion';
import './HelpNav.scss';
import block from '../../styles/bem';

const b = block('landing-help-nav');

export interface HelpNavItem {
	id: string;
	label: string;
	tone: string;
}

interface Props {
	items: HelpNavItem[];
	activeId: string;
	onSelect: (id: string) => void;
}

export default function HelpNav(props: Props) {
	const {items, activeId, onSelect} = props;
	const listRef = useRef<HTMLElement>(null);

	// On mobile the strip scrolls sideways, so the active chip has to be dragged
	// into view as the reader scrolls the page — otherwise it highlights a chip
	// that sits off-screen and the strip looks broken.
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const active = list.querySelector<HTMLElement>(`[data-help-nav="${activeId}"]`);
		if (!active) return;
		// Only worth doing while the strip is actually scrollable (mobile layout).
		if (list.scrollWidth <= list.clientWidth) return;
		const offset = active.offsetLeft - (list.clientWidth - active.clientWidth) / 2;
		list.scrollTo({left: Math.max(0, offset), behavior: 'smooth'});
	}, [activeId]);

	return (
		<nav className={b()} ref={listRef} aria-label="help sections">
			{items.map((item) => {
				const active = item.id === activeId;
				return (
					<button
						key={item.id}
						type="button"
						data-help-nav={item.id}
						className={b('item', {active})}
						style={{'--item-tone': item.tone} as React.CSSProperties}
						onClick={() => onSelect(item.id)}
						aria-current={active ? 'true' : undefined}
					>
						{active ? (
							<motion.span
								layoutId="help-nav-active"
								className={b('item-highlight')}
								transition={{type: 'spring', stiffness: 460, damping: 38}}
							/>
						) : null}
						<span className={b('item-sticker')} />
						<span className={b('item-label')}>{item.label}</span>
					</button>
				);
			})}
		</nav>
	);
}
