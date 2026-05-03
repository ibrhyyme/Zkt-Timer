import React from 'react';
import { useTranslation } from 'react-i18next';
import './SignUpButton.scss';
import { ArrowRight } from 'phosphor-react';
import block from '../../../../styles/bem';

const b = block('landing-signup-button');

export default function SignUpButton() {
	const { t } = useTranslation();

	return (
		<div className={b('wrapper')}>
			<a href="/signup" className={b()}>
				<span>{t('welcome_hero.start_now')}</span>
				<ArrowRight />
			</a>
		</div>
	);
}
