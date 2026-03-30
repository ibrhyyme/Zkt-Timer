import React from 'react';
import {Crown} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {closeModal} from '../../actions/general';
import block from '../../styles/bem';

const b = block('promo-success-modal');

interface Props {
	membershipType: string;
	expiresAt?: string;
}

export default function PromoSuccessModal({membershipType, expiresAt}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();

	const label = membershipType === 'pro' ? 'Pro' : 'Premium';

	let message: string;
	if (expiresAt) {
		const date = new Date(expiresAt).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
		message = t('pro_page.promo.success_until', {type: label, date});
	} else {
		message = t('pro_page.promo.success_forever', {type: label});
	}

	return (
		<div className={b()}>
			<div className={b('icon')}>
				<Crown weight="fill" />
			</div>
			<h2 className={b('title')}>{t('pro_page.promo.success_title')}</h2>
			<p className={b('message')}>{message}</p>
			<button type="button" className={b('cta')} onClick={() => dispatch(closeModal())}>
				{t('pro_page.promo.success_button')}
			</button>
		</div>
	);
}
