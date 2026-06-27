import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {WhatsappLogo, ArrowRight} from 'phosphor-react';

// Reuse the integration card layout so this sits visually as a sibling of the WCA card.
const b = block('integration');

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/KYKTvaG33xgJqUoKPucCfh';

export default function WhatsappCommunityCard() {
	const {t} = useTranslation();

	function handleJoin() {
		// Click-only window access keeps the component SSR-safe.
		window.open(WHATSAPP_COMMUNITY_URL, '_blank', 'noopener,noreferrer');
	}

	return (
		<div className={b()}>
			<div className={b('name')}>
				<WhatsappLogo size={70} weight="fill" color="#25D366" />
				<h4>{t('whatsapp_community.title')}</h4>
			</div>
			<div className={b('description')}>
				<p>{t('whatsapp_community.description')}</p>
			</div>
			<div className={b('actions')}>
				<Button
					fullWidth
					large
					primary
					text={t('whatsapp_community.join')}
					icon={<ArrowRight />}
					onClick={handleJoin}
				/>
			</div>
		</div>
	);
}
