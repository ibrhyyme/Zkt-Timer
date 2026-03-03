import React from 'react';
import {useTranslation} from 'react-i18next';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

export default function Terms() {
	const {t, i18n} = useTranslation();
	const isNonTurkish = !i18n.language?.startsWith('tr');

	return (
		<div className={b()}>
			<h1>{t('terms.title')}</h1>
			<p>{t('terms.last_update')}</p>
			<p dangerouslySetInnerHTML={{__html: t('terms.intro')}} />

			<h2>{t('terms.section_1_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('terms.section_1_text')}} />

			<h2>{t('terms.section_2_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('terms.section_2_text')}} />

			<h2>{t('terms.section_3_title')}</h2>
			<ul>
				<li>{t('terms.section_3_item_1')}</li>
				<li>{t('terms.section_3_item_2')}</li>
				<li>{t('terms.section_3_item_3')}</li>
				<li>{t('terms.section_3_item_4')}</li>
				<li>{t('terms.section_3_item_5')}</li>
			</ul>

			<h2>{t('terms.section_4_title')}</h2>
			<p>{t('terms.section_4_text')}</p>

			<h2>{t('terms.section_5_title')}</h2>
			<p>{t('terms.section_5_text')}</p>

			<h2>{t('terms.section_6_title')}</h2>
			<p>{t('terms.section_6_text')}</p>

			<h2>{t('terms.section_7_title')}</h2>
			<p>{t('terms.section_7_text')}</p>

			<h2>{t('terms.section_8_title')}</h2>
			<p>{t('terms.section_8_text')}</p>

			<h2>{t('terms.section_9_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('terms.section_9_text')}} />

			{isNonTurkish && (
				<>
					<hr />
					<p><em>{t('terms.legal_notice')}</em></p>
				</>
			)}
		</div>
	);
}
