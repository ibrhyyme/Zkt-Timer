import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import './CaseSection.scss';
import block from '../../../../styles/bem';
import { openModal } from '../../../../actions/general';
import { openProOnlyModal } from '../../../common/pro_only/openProOnlyModal';
import { useMe } from '../../../../util/hooks/useMe';
import { isPro } from '../../../../lib/pro';
import CaseStatsModal from './CaseStatsModal';

const b = block('case-section');

type CaseType = 'oll' | 'pll';

const CARDS: Array<{ id: CaseType; label: string }> = [
	{ id: 'oll', label: 'OLL' },
	{ id: 'pll', label: 'PLL' },
];

function OLLIcon() {
	return (
		<svg width={56} height={56} viewBox="0 0 50 50">
			{[0, 1, 2].map(r =>
				[0, 1, 2].map(c => (
					<rect key={`${r}-${c}`} x={10 + c * 10} y={10 + r * 10} width={10} height={10}
						fill="#FFFF49" stroke="#1a1a1a" strokeWidth={0.8} />
				))
			)}
		</svg>
	);
}

function PLLIcon() {
	return (
		<svg width={56} height={56} viewBox="0 0 50 50">
			{[0, 1, 2].map(r =>
				[0, 1, 2].map(c => (
					<rect key={`${r}-${c}`} x={10 + c * 10} y={10 + r * 10} width={10} height={10}
						fill="#FFFFFF" stroke="#1a1a1a" strokeWidth={0.8} />
				))
			)}
			<rect x={10} y={5} width={30} height={5} fill="#246BFD" stroke="#1a1a1a" strokeWidth={0.8} />
			<rect x={10} y={40} width={30} height={5} fill="#43FF43" stroke="#1a1a1a" strokeWidth={0.8} />
			<rect x={5} y={10} width={5} height={30} fill="#FF8A06" stroke="#1a1a1a" strokeWidth={0.8} />
			<rect x={40} y={10} width={5} height={30} fill="#FF4343" stroke="#1a1a1a" strokeWidth={0.8} />
		</svg>
	);
}

export default function CaseSection() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);

	function handleClick(type: CaseType) {
		if (!userIsPro) {
			openProOnlyModal(dispatch, t, 'smart_cube');
			return;
		}
		const title = type === 'oll'
			? t('case_stats.modal_title_oll')
			: t('case_stats.modal_title_pll');
		dispatch(openModal(<CaseStatsModal type={type} />, {
			title,
			closeButtonText: t('solve_info.done'),
			width: 1100,
		}));
	}

	return (
		<div className={b()}>
			{CARDS.map((card) => (
				<button
					key={card.id}
					type="button"
					className={b('card')}
					onClick={() => handleClick(card.id)}
					aria-label={card.label}
				>
					<div className={b('card-icon')}>
						{card.id === 'oll' ? <OLLIcon /> : <PLLIcon />}
					</div>
					<div className={b('card-label')}>{card.label}</div>
				</button>
			))}
		</div>
	);
}
