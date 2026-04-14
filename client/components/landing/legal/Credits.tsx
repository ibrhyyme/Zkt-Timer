import React from 'react';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

interface Reference {
	project: string;
	user: string;
	username: string; // empty string = no avatar
	link: string; // empty string = no link
	descKey: string;
	avatarOverride?: string;
}

const BUILDER: Reference = {
	project: 'Zkt Timer',
	user: 'ibrhyyme',
	username: 'ibrhyyme',
	link: '',
	descKey: 'credits.builder_ibrhyyme',
};

const INSPIRATIONS: Reference[] = [
	{
		project: 'cubedesk',
		user: 'kash',
		username: 'kash',
		link: 'https://github.com/kash/cubedesk',
		descKey: 'credits.inspiration_cubedesk',
	},
	{
		project: 'csTimer + min2phase',
		user: 'cs0x7f',
		username: 'cs0x7f',
		link: 'https://github.com/cs0x7f/csTimer',
		descKey: 'credits.inspiration_cstimer',
	},
	{
		project: 'cubedex',
		user: 'Pau Oliva Fora (poliva)',
		username: 'poliva',
		link: 'https://github.com/poliva/cubedex',
		descKey: 'credits.inspiration_cubedex',
	},
	{
		project: 'cubingapp',
		user: 'spencerchubb',
		username: 'spencerchubb',
		link: 'https://github.com/spencerchubb/cubingapp',
		descKey: 'credits.inspiration_cubingapp',
	},
	{
		project: 'RubiksSolverDemo',
		user: 'or18',
		username: 'or18',
		link: 'https://github.com/or18/RubiksSolverDemo',
		descKey: 'credits.inspiration_rubikssolverdemo',
	},
	{
		project: 'LetsCube',
		user: 'coder13',
		username: 'coder13',
		link: 'https://github.com/coder13/letscube',
		descKey: 'credits.inspiration_letscube',
	},
	{
		project: 'competitor-groups',
		user: 'coder13',
		username: 'coder13',
		link: 'https://github.com/coder13/competitor-groups',
		descKey: 'credits.inspiration_competitorgroups',
	},
	{
		project: 'wca-live',
		user: 'WCA Software Team',
		username: 'thewca',
		link: 'https://github.com/thewca/wca-live',
		descKey: 'credits.inspiration_wcalive',
	},
	{
		project: 'RecordRanks',
		user: 'Deni Mintsaev (mintydev)',
		username: 'mintydev',
		link: 'https://codeberg.org/mintydev/RecordRanks',
		descKey: 'credits.inspiration_recordranks',
		avatarOverride: 'https://codeberg.org/avatars/c11d08c95c19a69e97f6f2ecaf88bc74',
	},
	{
		project: 'Rubik-Cube',
		user: 'Dev-tanay',
		username: 'Dev-tanay',
		link: 'https://github.com/Dev-tanay/Rubik-Cube',
		descKey: 'credits.inspiration_rubikcube',
	},
];

const LIBRARIES: Reference[] = [
	{
		project: 'cubing.js',
		user: 'Lucas Garron & the cubing.js team',
		username: 'cubing',
		link: 'https://github.com/cubing/cubing.js',
		descKey: 'credits.libraries_cubingjs',
	},
	{
		project: 'gan-web-bluetooth',
		user: 'afedotov',
		username: 'afedotov',
		link: 'https://github.com/afedotov/gan-web-bluetooth',
		descKey: 'credits.libraries_ganweb',
	},
	{
		project: 'csTimer',
		user: 'cs0x7f',
		username: 'cs0x7f',
		link: 'https://github.com/cs0x7f/cstimer',
		descKey: 'credits.libraries_cstimer',
	},
	{
		project: 'cubejs',
		user: '',
		username: '',
		link: 'https://www.npmjs.com/package/cubejs',
		descKey: 'credits.libraries_cubejs',
	},
];

function getAvatar(item: Reference): string | null {
	if (item.avatarOverride) return item.avatarOverride;
	if (!item.username) return null;
	return `https://github.com/${item.username}.png?size=80`;
}

function ReferenceItem({item, t}: {item: Reference; t: TFunction}) {
	const avatar = getAvatar(item);
	return (
		<li className={b('ref-item')}>
			{avatar ? (
				<img
					src={avatar}
					alt={item.user || item.project}
					loading="lazy"
					className={b('avatar')}
				/>
			) : (
				<div className={b('avatar', {placeholder: true})} aria-hidden="true" />
			)}
			<div className={b('ref-body')}>
				<div className={b('ref-header')}>
					{item.link ? (
						<a href={item.link} target="_blank" rel="noopener noreferrer">
							<strong>{item.project}</strong>
						</a>
					) : (
						<strong>{item.project}</strong>
					)}
					{item.user && <span className={b('ref-user')}> — {item.user}</span>}
				</div>
				<div
					className={b('ref-desc')}
					dangerouslySetInnerHTML={{__html: t(item.descKey)}}
				/>
			</div>
		</li>
	);
}

export default function Credits() {
	const {t} = useTranslation();

	const allRefs = [...INSPIRATIONS, ...LIBRARIES];

	return (
		<div className={b()}>
			<h1>{t('credits.title')}</h1>
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_1')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_2')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_3')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.intro_4')}} />

			<ul className={b('refs')}>
				<ReferenceItem item={BUILDER} t={t} />
			</ul>

			<h2>{t('credits.credits_section_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_intro_1')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_intro_2')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_intro_3')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_intro_4')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_belief')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_outro')}} />
			<p dangerouslySetInnerHTML={{__html: t('credits.credits_thanks')}} />
			<p>
				<em>{t('credits.intro_signature')}</em>
			</p>

			<h2>{t('credits.inspiration_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.inspiration_desc')}} />
			<ul className={b('refs')}>
				{INSPIRATIONS.map((it) => (
					<ReferenceItem key={it.project} item={it} t={t} />
				))}
			</ul>

			<h2>{t('credits.libraries_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.libraries_desc')}} />
			<ul className={b('refs')}>
				{LIBRARIES.map((it) => (
					<ReferenceItem key={it.project} item={it} t={t} />
				))}
			</ul>

			<h2>{t('credits.opensource_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.opensource_text')}} />

			<h2>{t('credits.community_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.community_text')}} />

			<h2>{t('credits.copyright_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('credits.copyright_text')}} />
			<ul>
				{allRefs.map((it) => (
					<li key={it.project}>
						Copyright (c){' '}
						{it.link ? (
							<a href={it.link} target="_blank" rel="noopener noreferrer">
								<strong>{it.user || it.project}</strong>
							</a>
						) : (
							<strong>{it.user || it.project}</strong>
						)}{' '}
						({it.project})
					</li>
				))}
				<li dangerouslySetInnerHTML={{__html: t('credits.copyright_zkt')}} />
			</ul>
			<p dangerouslySetInnerHTML={{__html: t('credits.license_text')}} />
		</div>
	);
}
