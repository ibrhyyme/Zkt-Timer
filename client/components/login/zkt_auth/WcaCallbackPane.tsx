import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	activeStep: number;
	/** Which provider's copy to show. The step layout is identical for both. */
	provider?: 'wca' | 'zkt';
}

export default function WcaCallbackPane({ activeStep, provider = 'wca' }: Props) {
	const { t } = useTranslation();

	const ns = provider === 'zkt' ? 'zkt_auth.zkt_callback' : 'zkt_auth.wca_callback';
	const steps = [
		{ title: t(`${ns}.step1_title`), sub: t(`${ns}.step1_sub`) },
		{ title: t(`${ns}.step2_title`), sub: t(`${ns}.step2_sub`) },
		{ title: t(`${ns}.step3_title`), sub: t(`${ns}.step3_sub`) },
		{ title: t(`${ns}.step4_title`), sub: t(`${ns}.step4_sub`) },
	];

	return (
		<div className={b('wca-callback')}>
			<p className={b('subtitle')}>{t(`${ns}.subtitle`)}</p>
			<ul className={b('steps')}>
				{steps.map((s, i) => {
					const done = i < activeStep;
					const active = i === activeStep;
					return (
						<li
							key={i}
							className={b('step', { active, done })}
						>
							<span className={b('step-icon')}>
								{done ? <Check size={14} weight="bold" /> : i + 1}
							</span>
							<div className={b('step-body')}>
								<div className={b('step-title')}>{s.title}</div>
								<div className={b('step-sub')}>{s.sub}</div>
							</div>
							{active && <span className={b('step-spin')} />}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
