/**
 * OllListView — entry view of the OLLCP mode.
 *  • Mobile: 2-column grid of OLL orientation shapes; tap card → OllDetailView, corner checkbox →
 *    multi-select.
 *  • Web: every OLL expanded inline (the standalone reference look) — shape + "Çalış" +
 *    discriminator checklist + the 6 variant cards; header checkbox → multi-select.
 * Selecting ≥1 OLL reveals a sticky bar to train all selected OLLs mixed together.
 */
import React, {useState} from 'react';
import block from '../../../../styles/bem';
import {useGeneral} from '../../../../util/hooks/useGeneral';
import {useOllcp} from '../OllcpContext';
import {OLL_NUMBERS, OLLCP_DATA, OLLCP_SIMILAR} from '../data';
import OllShape from '../components/OllShape';
import OllcpCard from '../components/OllcpCard';

const b = block('trainer-ollcp');

export default function OllListView() {
	const mobileMode = useGeneral('mobile_mode');
	const {openOll, trainOll, trainMulti} = useOllcp();
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const toggle = (num: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(num)) next.delete(num);
			else next.add(num);
			return next;
		});

	// Sticky action bar — appears once at least one OLL is selected. Pass OLLs in canonical order.
	const bar = selected.size > 0 && (
		<div className={b('select-bar')}>
			<span className={b('select-count')}>{selected.size} OLL seçili</span>
			<button type="button" className={b('select-clear')} onClick={() => setSelected(new Set())}>
				Temizle
			</button>
			<button
				type="button"
				className={b('select-train')}
				onClick={() => trainMulti(OLL_NUMBERS.filter((n) => selected.has(n)))}
			>
				Karışık Çalış
			</button>
		</div>
	);

	if (mobileMode) {
		return (
			<>
				<div className={b('list')}>
					{OLL_NUMBERS.map((num) => {
						const sel = selected.has(num);
						return (
							<div
								key={num}
								className={b('list-item', {selected: sel})}
								role="button"
								tabIndex={0}
								onClick={() => openOll(num)}
							>
								<button
									type="button"
									className={b('check', {on: sel})}
									onClick={(e) => {
										e.stopPropagation();
										toggle(num);
									}}
									aria-label={sel ? 'Seçimi kaldır' : 'Seç'}
								>
									{sel ? '✓' : ''}
								</button>
								<OllShape pattern={OLLCP_DATA[num].shape} size={66} />
								<span className={b('list-label')}>OLL {num}</span>
							</div>
						);
					})}
				</div>
				{bar}
			</>
		);
	}

	// Web: full reference — all OLLs expanded.
	return (
		<>
			<div className={b('web')}>
				{OLL_NUMBERS.map((num) => {
					const oll = OLLCP_DATA[num];
					const sel = selected.has(num);
					return (
						<section key={num} className={b('oll', {selected: sel})}>
							<div className={b('oll-head')}>
								<button
									type="button"
									className={b('check', {on: sel})}
									onClick={() => toggle(num)}
									aria-label={sel ? 'Seçimi kaldır' : 'Seç'}
								>
									{sel ? '✓' : ''}
								</button>
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
								{oll.variants.map((v, i) => (
									<OllcpCard key={v.n} variant={v} similar={OLLCP_SIMILAR[num][i]} />
								))}
							</div>
						</section>
					);
				})}
			</div>
			{bar}
		</>
	);
}
