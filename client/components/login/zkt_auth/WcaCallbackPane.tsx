import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	activeStep: number;
}

export default function WcaCallbackPane({ activeStep }: Props) {
	const { t } = useTranslation();

	const steps = [
		{ title: t('zkt_auth.wca_callback.step1_title'), sub: t('zkt_auth.wca_callback.step1_sub') },
		{ title: t('zkt_auth.wca_callback.step2_title'), sub: t('zkt_auth.wca_callback.step2_sub') },
		{ title: t('zkt_auth.wca_callback.step3_title'), sub: t('zkt_auth.wca_callback.step3_sub') },
		{ title: t('zkt_auth.wca_callback.step4_title'), sub: t('zkt_auth.wca_callback.step4_sub') },
	];

	return (
		<div className={b('wca-callback')}>
			<p className={b('subtitle')}>{t('zkt_auth.wca_callback.subtitle')}</p>
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
