/**
 * OllListView — entry view of the OLLCP mode.
 *  • Mobile: 2-column grid of OLL shapes. Tap a card → OllDetailView. LONG-PRESS a card → enter
 *    gallery-style select mode (the "Çalış" CTA appears top-right in the header); then tapping cards
 *    toggles selection. No always-on checkboxes; selection lives in context so it never gets lost.
 *  • Web: every OLL expanded inline (reference look) with a per-OLL "Çalış". The header "Seç" button
 *    enters select mode; then clicking an OLL header toggles its selection.
 */
import React, {useRef} from 'react';
import block from '../../../../styles/bem';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import {useOllcp} from '../OllcpContext';
import {OLL_NUMBERS, OLLCP_DATA, OLLCP_SIMILAR} from '../data';
import OllShape from '../components/OllShape';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');
const LONG_PRESS_MS = 450;

export default function OllListView() {
	const mobileMode = useGeneral('mobile_mode');
	const {state, openOll, trainOll, enterSelect, toggleSelect} = useOllcp();
	const {selectMode, selected} = state;

	const pressTimer = useRef<number | null>(null);
	const longFired = useRef(false);

	const clearPress = () => {
		if (pressTimer.current) {
			clearTimeout(pressTimer.current);
			pressTimer.current = null;
		}
	};

	// Long-press (mobile) → enter select mode with this card picked. Any movement cancels it so a
	// scroll never turns into a selection.
	const startPress = (num: string) => {
		longFired.current = false;
		clearPress();
		pressTimer.current = window.setTimeout(() => {
			pressTimer.current = null;
			if (!state.selectMode) {
				longFired.current = true;
				navigator.vibrate?.(10);
				enterSelect(num);
			}
		}, LONG_PRESS_MS);
	};

	const onCardClick = (num: string) => {
		if (longFired.current) {
			longFired.current = false; // swallow the click that follows a long-press
			return;
		}
		if (selectMode) toggleSelect(num);
		else openOll(num);
	};

	if (mobileMode) {
		return (
			<div className={b('list')}>
				{OLL_NUMBERS.map((num) => {
					const sel = selected.includes(num);
					return (
						<div
							key={num}
							className={b('list-item', {selected: sel})}
							role="button"
							tabIndex={0}
							onPointerDown={() => startPress(num)}
							onPointerMove={clearPress}
							onPointerUp={clearPress}
							onPointerLeave={clearPress}
							onPointerCancel={clearPress}
							onClick={() => onCardClick(num)}
						>
							{selectMode && sel && <span className={b('sel-badge')}>✓</span>}
							<OllShape pattern={OLLCP_DATA[num].shape} size={66} />
							<span className={b('list-label')}>OLL {num}</span>
						</div>
					);
				})}
			</div>
		);
	}

	// Web: full reference — all OLLs expanded.
	return (
		<div className={b('web')}>
			{OLL_NUMBERS.map((num) => {
				const oll = OLLCP_DATA[num];
				const sel = selected.includes(num);
				return (
					<section key={num} className={b('oll', {selected: selectMode && sel})}>
						<div
							className={b('oll-head', {selectable: selectMode})}
							onClick={selectMode ? () => toggleSelect(num) : undefined}
						>
							{selectMode && sel && <span className={b('sel-badge', {inline: true})}>✓</span>}
							<div className={b('oll-shape')}>
								<OllShape pattern={oll.shape} size={56} />
							</div>
							<h3 className={b('oll-title')}>OLL {num}</h3>
							{!selectMode && (
								<button type="button" className={b('train-btn')} onClick={() => trainOll(num)}>
									Çalış
								</button>
							)}
							<span className={b('checklist')}>
								<b>Ayırt et →</b> {oll.checkList.join(' · ')}
							</span>
						</div>
						<div className={b('cards')}>
							{oll.variants.map((v, i) => (
								<OllcpCard key={v.n} variant={v} similar={OLLCP_SIMILAR[num][i]} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
