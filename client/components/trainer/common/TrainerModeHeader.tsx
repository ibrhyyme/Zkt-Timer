/**
 * TrainerModeHeader — 4 trainer modunun (standard/smart/recognition/efficiency) paylastigi
 * ortak slim baslik cercevesi. Cerceve hep ayni; icerik (mod ikonu/rengi/adi + aksiyonlar)
 * moda gore degisir. Mod ikonu+rengi landing kartlariyla ayni → "tikladigin kart bu" surekliligi.
 *
 * Sol: geri pill (mod kokunde "Antrenor" → landing; alt-view'da "Geri" → mod koku) + renkli
 * mod ikonu + mod adi. Sag: moda ozel aksiyonlar (ortak __btn stili).
 */
import React, {ReactNode} from 'react';
import {Timer, BluetoothConnected, Lightning, Eye, ArrowLeft} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import './TrainerModeHeader.scss';
import type {TrainerMode} from '../types';

const b = block('trainer-header');

type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

const MODE_META: Record<TrainerMode, {icon: ReactNode; color: AccentColor; titleKey: string}> = {
	standard: {icon: <Timer size={18} weight="duotone" />, color: 'blue', titleKey: 'trainer.landing_standard_title'},
	smart: {icon: <BluetoothConnected size={18} weight="duotone" />, color: 'purple', titleKey: 'trainer.landing_smart_title'},
	efficiency: {icon: <Lightning size={18} weight="duotone" />, color: 'green', titleKey: 'trainer.landing_efficiency_title'},
	recognition: {icon: <Eye size={18} weight="duotone" />, color: 'orange', titleKey: 'trainer.landing_recognition_title'},
};

interface Props {
	mode: TrainerMode;
	onBack: () => void;
	/** true → geri "Antrenor" (landing'e); false → "Geri" (mod koku) */
	backToRoot: boolean;
	actions?: ReactNode;
}

export default function TrainerModeHeader(props: Props) {
	const {mode, onBack, backToRoot, actions} = props;
	const {t} = useTranslation();
	const meta = MODE_META[mode];

	return (
		<div className={b()}>
			<div className={b('left')}>
				<button type="button" className={b('back')} onClick={onBack}>
					<ArrowLeft size={16} weight="bold" />
					<span>
						{backToRoot
							? t('trainer.header_to_landing', {defaultValue: 'Trainer'})
							: t('trainer.back', {defaultValue: 'Geri'})}
					</span>
				</button>
				<span className={b('icon', {[meta.color]: true})} aria-hidden="true">
					{meta.icon}
				</span>
				<span className={b('title')}>{t(meta.titleKey)}</span>
			</div>
			{actions ? <div className={b('actions')}>{actions}</div> : null}
		</div>
	);
}
