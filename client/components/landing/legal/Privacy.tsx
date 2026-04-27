import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft} from 'phosphor-react';
import './Legal.scss';
import block from '../../../styles/bem';
import {isNative} from '../../../util/platform';

const b = block('landing-legal');

export default function Privacy() {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const isNonTurkish = !i18n.language?.startsWith('tr');

	return (
		<div className={b()}>
			{isNative() && (
				<button type="button" className={b('back-btn')} onClick={() => history.goBack()}>
					<ArrowLeft weight="bold" size={20} />
				</button>
			)}
			<h1>{t('privacy.title')}</h1>
			<p>{t('privacy.last_update')}</p>
			<p dangerouslySetInnerHTML={{__html: t('privacy.intro_1')}} />
			<p>{t('privacy.intro_2')}</p>

			<h2>{t('privacy.section_1_title')}</h2>
			<p>{t('privacy.section_1_text')}</p>

			<h2>{t('privacy.section_2_title')}</h2>
			<p>{t('privacy.section_2_text')}</p>
			<ul>
				<li>{t('privacy.section_2_item_1')}</li>
				<li>{t('privacy.section_2_item_2')}</li>
				<li>{t('privacy.section_2_item_3')}</li>
				<li>{t('privacy.section_2_item_4')}</li>
				<li>{t('privacy.section_2_item_5')}</li>
				<li>{t('privacy.section_2_item_6')}</li>
			</ul>

			<h2>{t('privacy.section_3_title')}</h2>
			<p>{t('privacy.section_3_text')}</p>
			<ul>
				<li dangerouslySetInnerHTML={{__html: t('privacy.section_3_item_1')}} />
				<li dangerouslySetInnerHTML={{__html: t('privacy.section_3_item_2')}} />
				<li dangerouslySetInnerHTML={{__html: t('privacy.section_3_item_3')}} />
				<li dangerouslySetInnerHTML={{__html: t('privacy.section_3_item_4')}} />
			</ul>

			<h2>{t('privacy.section_4_title')}</h2>
			<p>{t('privacy.section_4_text')}</p>
			<ul>
				<li>{t('privacy.section_4_item_1')}</li>
				<li>{t('privacy.section_4_item_2')}</li>
				<li>{t('privacy.section_4_item_3')}</li>
				<li>{t('privacy.section_4_item_4')}</li>
			</ul>
			<p>{t('privacy.section_4_footer')}</p>

			<h2>{t('privacy.section_5_title')}</h2>
			<p>{t('privacy.section_5_text')}</p>
			<ul>
				<li>{t('privacy.section_5_item_1')}</li>
				<li>{t('privacy.section_5_item_2')}</li>
				<li>{t('privacy.section_5_item_3')}</li>
				<li>{t('privacy.section_5_item_4')}</li>
				<li>{t('privacy.section_5_item_5')}</li>
			</ul>
			<p>{t('privacy.section_5_footer')}</p>
			<p>{t('privacy.section_5_international')}</p>

			<h2>{t('privacy.section_6_title')}</h2>
			<p>{t('privacy.section_6_text')}</p>
			<ul>
				<li>{t('privacy.section_6_item_1')}</li>
				<li>{t('privacy.section_6_item_2')}</li>
				<li>{t('privacy.section_6_item_3')}</li>
				<li>{t('privacy.section_6_item_4')}</li>
				<li>{t('privacy.section_6_item_5')}</li>
				<li>{t('privacy.section_6_item_6')}</li>
				<li>{t('privacy.section_6_item_7')}</li>
				<li>{t('privacy.section_6_item_8')}</li>
			</ul>
			<p dangerouslySetInnerHTML={{__html: t('privacy.section_6_contact')}} />

			<hr />

			<h1>{t('privacy.cookie_title')}</h1>
			<p>{t('privacy.cookie_intro')}</p>

			<h2>{t('privacy.cookie_section_1_title')}</h2>
			<p>{t('privacy.cookie_section_1_text')}</p>

			<h2>{t('privacy.cookie_section_2_title')}</h2>
			<ul>
				<li dangerouslySetInnerHTML={{__html: t('privacy.cookie_section_2_item_1')}} />
				<li dangerouslySetInnerHTML={{__html: t('privacy.cookie_section_2_item_2')}} />
				<li dangerouslySetInnerHTML={{__html: t('privacy.cookie_section_2_item_3')}} />
			</ul>

			<h2>{t('privacy.cookie_section_3_title')}</h2>
			<p>{t('privacy.cookie_section_3_text')}</p>
			<p dangerouslySetInnerHTML={{__html: t('privacy.cookie_contact')}} />

			{isNonTurkish && (
				<>
					<hr />
					<p><em>{t('privacy.legal_notice')}</em></p>
				</>
			)}
		</div>
	);
}
