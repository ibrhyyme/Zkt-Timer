import React from 'react';
import {useTranslation} from 'react-i18next';
import './LandingFooter.scss';
import block from '../../../../styles/bem';

const b = block('landing-footer');

export default function LandingFooter() {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<ul>
				<li>
					<a href="mailto:ibrhyyme@icloud.com">{t('landing_footer.support')}</a>
				</li>
				<li>
					<a href="/terms">{t('landing_footer.terms')}</a>
				</li>
				<li>
					<a href="/credits">{t('landing_footer.credits')}</a>
				</li>
				<li>
					<a href="/privacy">{t('landing_footer.privacy')}</a>
				</li>
			</ul>
		</div>
	);
}
