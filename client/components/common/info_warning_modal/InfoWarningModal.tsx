import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Info, Warning, WarningOctagon} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../button/Button';
import Checkbox from '../checkbox/Checkbox';
import {setSetting} from '../../../db/settings/update';
import {AllSettings} from '../../../db/settings/query';
import './InfoWarningModal.scss';

const b = block('info-warning-modal');

interface Props {
	// "Bu ozellik nasil calisir" basligi (cagiran caller i18n cevirisi gecer)
	stepsHeading: string;
	// Numarali kart liste
	steps: string[];
	// Turuncu callout — kullanim/sinirlama notu
	warning?: {
		title: string;
		text: string;
	};
	// Kirmizi callout — kritik uyari
	critical?: string;
	// Gri tonlu nötr aciklama (orn. "Bu sinirlama protokolden kaynaklaniyor")
	protocolNote?: string;
	// "Bir daha gosterme" işaretlenirse bu setting key'i true yapilir
	showAgainKey: keyof AllSettings;
	onComplete?: () => void;
}

export default function InfoWarningModal({
	stepsHeading,
	steps,
	warning,
	critical,
	protocolNote,
	showAgainKey,
	onComplete,
}: Props) {
	const {t} = useTranslation();
	const [dontShowAgain, setDontShowAgain] = useState(false);

	function handleClose() {
		if (dontShowAgain) {
			setSetting(showAgainKey, true as never);
		}
		onComplete?.();
	}

	return (
		<div className={b()}>
			{steps.length > 0 && (
				<div className={b('steps')}>
					<div className={b('steps-heading')}>
						<Info size={18} weight="bold" />
						<span>{stepsHeading}</span>
					</div>
					<ol className={b('steps-list')}>
						{steps.map((step, i) => (
							<li key={i} className={b('step')}>
								<span className={b('step-index')}>{i + 1}</span>
								<span className={b('step-text')}>{step}</span>
							</li>
						))}
					</ol>
				</div>
			)}

			{warning && (
				<div className={b('callout', {warning: true})}>
					<Warning size={20} weight="fill" className={b('callout-icon')} />
					<div className={b('callout-body')}>
						<div className={b('callout-title')}>{warning.title}</div>
						<div className={b('callout-text')}>{warning.text}</div>
					</div>
				</div>
			)}

			{protocolNote && (
				<div className={b('protocol-note')}>{protocolNote}</div>
			)}

			{critical && (
				<div className={b('callout', {critical: true})}>
					<WarningOctagon size={20} weight="fill" className={b('callout-icon')} />
					<div className={b('callout-text')}>{critical}</div>
				</div>
			)}

			<div className={b('footer')}>
				<Checkbox
					checked={dontShowAgain}
					onChange={() => setDontShowAgain(!dontShowAgain)}
					text={t('timer_settings.dont_show_again')}
				/>
				<Button
					text={t('timer_settings.understood')}
					primary
					large
					onClick={handleClose}
				/>
			</div>
		</div>
	);
}
