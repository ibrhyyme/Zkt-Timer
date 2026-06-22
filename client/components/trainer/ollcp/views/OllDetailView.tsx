/**
 * OllDetailView — one OLL drilled in (mobile). "Çalış" button at top → timed practice,
 * the discriminator checklist, then the 6 variant cards in a 2-column grid.
 */
import React from 'react';
import block from '../../../../styles/bem';
import {useOllcp} from '../OllcpContext';
import {OLLCP_DATA} from '../data';
import OllShape from '../components/OllShape';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');

export default function OllDetailView() {
	const {state, startTrain} = useOllcp();
	const num = state.currentOll;
	const oll = num ? OLLCP_DATA[num] : undefined;
	if (!num || !oll) return null;

	return (
		<div className={b('detail')}>
			<div className={b('detail-head')}>
				<div className={b('oll-shape')}>
					<OllShape pattern={oll.shape} size={56} />
				</div>
				<div className={b('detail-head-text')}>
					<h3 className={b('oll-title')}>OLL {num}</h3>
					<span className={b('checklist')}>
						<b>Ayırt et →</b> {oll.checkList.join(' · ')}
					</span>
				</div>
				<button type="button" className={b('train-btn', {large: true})} onClick={startTrain}>
					Çalış ↻
				</button>
			</div>
			<div className={b('cards')}>
				{oll.variants.map((v) => (
					<OllcpCard key={v.n} variant={v} />
				))}
			</div>
		</div>
	);
}
