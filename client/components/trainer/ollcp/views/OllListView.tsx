/**
 * OllListView — entry view of the OLLCP mode.
 *  • Mobile: 2-column grid of OLL orientation shapes; tap → OllDetailView.
 *  • Web: every OLL expanded inline (the standalone reference look) — shape + "Çalış" +
 *    discriminator checklist + the 6 variant cards.
 */
import React from 'react';
import block from '../../../../styles/bem';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import {useOllcp} from '../OllcpContext';
import {OLL_NUMBERS, OLLCP_DATA} from '../data';
import OllShape from '../components/OllShape';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');

export default function OllListView() {
	const mobileMode = useGeneral('mobile_mode');
	const {openOll, trainOll} = useOllcp();

	if (mobileMode) {
		return (
			<div className={b('list')}>
				{OLL_NUMBERS.map((num) => (
					<button key={num} type="button" className={b('list-item')} onClick={() => openOll(num)}>
						<OllShape pattern={OLLCP_DATA[num].shape} size={66} />
						<span className={b('list-label')}>OLL {num}</span>
					</button>
				))}
			</div>
		);
	}

	// Web: full reference — all OLLs expanded.
	return (
		<div className={b('web')}>
			{OLL_NUMBERS.map((num) => {
				const oll = OLLCP_DATA[num];
				return (
					<section key={num} className={b('oll')}>
						<div className={b('oll-head')}>
							<div className={b('oll-shape')}>
								<OllShape pattern={oll.shape} size={56} />
							</div>
							<h3 className={b('oll-title')}>OLL {num}</h3>
							<button type="button" className={b('train-btn')} onClick={() => trainOll(num)}>
								Çalış
							</button>
							<span className={b('checklist')}>
								<b>Ayırt et →</b> {oll.checkList.join(' · ')}
							</span>
						</div>
						<div className={b('cards')}>
							{oll.variants.map((v) => (
								<OllcpCard key={v.n} variant={v} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
