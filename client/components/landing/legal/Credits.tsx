import React from 'react';
import {useTranslation} from 'react-i18next';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

export default function Credits() {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<h1>{t('credits.title')}</h1>
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_1')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_2')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_3')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_4')}} />
			<p><em>{t('credits.intro_signature')}</em></p>

			<h2>{t('credits.core_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.core_text')}} />
			<ul>
				<li dangerouslySetInnerHTML={{__html: t('credits.core_item')}} />
			</ul>

			<h2>{t('credits.features_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.features_text')}} />
			<ul>
				<li dangerouslySetInnerHTML={{__html: t('credits.features_multiplayer')}} />
				<li dangerouslySetInnerHTML={{__html: t('credits.features_scramble')}} />
				<li dangerouslySetInnerHTML={{__html: t('credits.features_algorithm_tutorials')}} />
				<li dangerouslySetInnerHTML={{__html: t('credits.features_smart_cube')}} />
				<li dangerouslySetInnerHTML={{__html: t('credits.features_algorithm_db')}} />
			</ul>

			<h2>{t('credits.third_party_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.third_party_text')}} />

			<h2>{t('credits.copyright_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.copyright_text')}} />
			<ul>
				<li>
					Copyright (c) 2021-2023 <strong>kash</strong> (cubedesk)
				</li>
				<li>
					Copyright (c) 2023 <strong>coder13</strong>
				</li>
				<li>
					Copyright (c) 2023 <strong>cs0x7f</strong>
				</li>
				<li>
					Copyright (c) 2023 <strong>poliva</strong>
				</li>
				<li>
					Copyright (c) 2023 <strong>afedotov</strong>
				</li>
				<li>
					Copyright (c) 2023 <strong>spencerchubb</strong> (cubingapp)
				</li>
			</ul>
			<p><strong dangerouslySetInnerHTML={{__html: t('credits.copyright_zkt_title')}} /></p>
			<ul>
				<li dangerouslySetInnerHTML={{__html: t('credits.copyright_zkt')}} />
			</ul>
			<p dangerouslySetInnerHTML={{__html: t('credits.license')}} />
		</div>
	);
}
