import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../../timer/smart_cube/bluetooth/supported_cubes';
import {STICKER, Face} from '../landing-data';
import NotationHeading from '../notation_heading/NotationHeading';
import './InsideSection.scss';

const b = block('welcome-inside');

interface Group {
	id: string;
	face: Face;
	items: {key: string; pro?: boolean}[];
}

// Every line was checked against the app (the help page and the code behind it) on
// 2026-09-30. Pro flags follow the gates in the app, so the list never offers a Pro
// feature as if it came with every account.
const GROUPS: Group[] = [
	{
		id: 'timer',
		face: 'U',
		items: [
			{key: 'inspection'},
			{key: 'inputs'},
			{key: 'scrambles'},
			{key: 'solvers'},
			{key: 'layout'},
			{key: 'background', pro: true},
			{key: 'drop', pro: true},
		],
	},
	{
		id: 'smart',
		face: 'F',
		items: [
			{key: 'brands'},
			{key: 'mirror'},
			{key: 'auto'},
			{key: 'scramble'},
			{key: 'phases', pro: true},
			{key: 'cases', pro: true},
		],
	},
	{
		id: 'training',
		face: 'L',
		items: [
			{key: 'modes'},
			{key: 'sets'},
			{key: 'puzzles'},
			{key: 'weak'},
			{key: 'quest'},
			{key: 'smart', pro: true},
			{key: 'pdf', pro: true},
		],
	},
	{
		id: 'stats',
		face: 'D',
		items: [
			{key: 'averages'},
			{key: 'charts'},
			{key: 'sessions'},
			{key: 'goals'},
			{key: 'import'},
			{key: 'sync'},
		],
	},
	{
		id: 'together',
		face: 'B',
		items: [{key: 'rooms'}, {key: 'battle'}, {key: 'messages'}, {key: 'profile'}, {key: 'rankings'}],
	},
	{
		id: 'competitions',
		face: 'R',
		items: [
			{key: 'upcoming'},
			{key: 'live'},
			{key: 'groups'},
			{key: 'persons'},
			{key: 'records'},
			{key: 'alerts', pro: true},
		],
	},
];

/** "GAN, MoYu and QiYi" in the reader's language, from the scanner's own brand table. */
function brandList(lang: string): string {
	const brands = SUPPORTED_SMART_CUBE_BRANDS.map((entry) => entry.brand);
	const ListFormat = (Intl as any).ListFormat;
	if (!ListFormat) return brands.join(', ');
	try {
		return new ListFormat(lang, {style: 'long', type: 'conjunction'}).format(brands);
	} catch {
		return brands.join(', ');
	}
}

export default function InsideSection() {
	const {t, i18n} = useTranslation();
	const vars = {brands: brandList(i18n.language || 'en')};

	return (
		<section className={b()}>
			<div className={b('container')}>
				<header className={b('header')}>
					<NotationHeading className={b('title')} text={t('welcome_inside.title')} />
					<p className={b('lede')}>{t('welcome_inside.lede')}</p>
				</header>

				<div className={b('grid')}>
					{GROUPS.map((group) => (
						<div
							key={group.id}
							className={b('group')}
							style={{'--face': STICKER[group.face]} as React.CSSProperties}
						>
							<h3 className={b('group-title')}>
								<span className={b('sticker')} aria-hidden="true" />
								{t(`welcome_inside.${group.id}.title`)}
							</h3>
							<ul className={b('items')}>
								{group.items.map((item) => (
									<li key={item.key} className={b('item')}>
										<span>{t(`welcome_inside.${group.id}.${item.key}`, vars)}</span>
										{item.pro && <span className={b('pro')}>Pro</span>}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<p className={b('platforms')}>{t('welcome_inside.platforms')}</p>
			</div>
		</section>
	);
}
