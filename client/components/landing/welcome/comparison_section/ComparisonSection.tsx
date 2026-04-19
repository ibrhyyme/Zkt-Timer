import React from 'react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {CheckCircle, XCircle, MinusCircle, Medal} from 'phosphor-react';
import block from '../../../../styles/bem';
import {staggerContainer, fadeInUp} from '../motion-variants';
import './ComparisonSection.scss';

const b = block('welcome-comparison');

type Mark = 'yes' | 'no' | 'partial';

interface Row {
	labelKey: string;
	values: [Mark, Mark, Mark, Mark]; // zkt, cstimer, twisty, cubedesk
}

const ROWS: Row[] = [
	{labelKey: 'welcome_comparison.row_wca_scrambles', values: ['yes', 'yes', 'yes', 'yes']},
	{labelKey: 'welcome_comparison.row_smart_cube', values: ['yes', 'yes', 'partial', 'yes']},
	{labelKey: 'welcome_comparison.row_stackmat_gan', values: ['yes', 'partial', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_solver', values: ['yes', 'yes', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_trainer', values: ['yes', 'partial', 'no', 'partial']},
	{labelKey: 'welcome_comparison.row_1v1_battle', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_rooms', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_wca_oauth', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_wca_competitions', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_wca_live', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_wca_notifications', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_wca_assignments', values: ['yes', 'no', 'no', 'no']},
	{labelKey: 'welcome_comparison.row_native_apps', values: ['yes', 'no', 'yes', 'no']},
	{labelKey: 'welcome_comparison.row_offline_sync', values: ['yes', 'yes', 'yes', 'partial']},
];

function Cell({mark}: {mark: Mark}) {
	if (mark === 'yes') {
		return (
			<span className="cd-welcome-comparison__mark cd-welcome-comparison__mark--yes">
				<CheckCircle size={20} weight="fill" />
			</span>
		);
	}
	if (mark === 'partial') {
		return (
			<span className="cd-welcome-comparison__mark cd-welcome-comparison__mark--partial">
				<MinusCircle size={20} weight="fill" />
			</span>
		);
	}
	return (
		<span className="cd-welcome-comparison__mark cd-welcome-comparison__mark--no">
			<XCircle size={20} weight="fill" />
		</span>
	);
}

export default function ComparisonSection() {
	const {t} = useTranslation();

	return (
		<section className={b()}>
			<div className={b('container')}>
				<motion.div
					className={b('header')}
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{once: true, amount: 0.3}}
				>
					<motion.div className={b('eyebrow')} variants={fadeInUp}>
						<Medal size={16} weight="fill" />
						<span>{t('welcome_comparison.eyebrow')}</span>
					</motion.div>
					<motion.h2 className={b('title')} variants={fadeInUp}>
						{t('welcome_comparison.title')}
					</motion.h2>
					<motion.p className={b('subtitle')} variants={fadeInUp}>
						{t('welcome_comparison.subtitle')}
					</motion.p>
				</motion.div>

				<motion.div
					className={b('table-wrap')}
					initial={{opacity: 0, y: 30}}
					whileInView={{opacity: 1, y: 0}}
					viewport={{once: true, amount: 0.15}}
					transition={{duration: 0.6}}
				>
					<table className={b('table')}>
						<thead>
							<tr>
								<th className={b('th', {feature: true})}>
									{t('welcome_comparison.th_feature')}
								</th>
								<th className={b('th', {highlight: true})}>
									<div className={b('th-logo', {highlight: true})}>
										<img src="/public/images/zkt-logo.png" alt="Zkt Timer" />
									</div>
									<span className={b('th-name')}>Zkt Timer</span>
									<span className={b('th-badge')}>{t('welcome_comparison.badge_us')}</span>
								</th>
								<th className={b('th')}>
									<span className={b('th-name')}>csTimer</span>
								</th>
								<th className={b('th', {hide: 'sm'})}>
									<span className={b('th-name')}>Twisty Timer</span>
								</th>
								<th className={b('th', {hide: 'sm'})}>
									<span className={b('th-name')}>CubeDesk</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{ROWS.map((row, i) => (
								<tr key={row.labelKey} className={b('tr', {even: i % 2 === 0})}>
									<td className={b('td', {feature: true})}>{t(row.labelKey)}</td>
									<td className={b('td', {highlight: true})}>
										<Cell mark={row.values[0]} />
									</td>
									<td className={b('td')}>
										<Cell mark={row.values[1]} />
									</td>
									<td className={b('td', {hide: 'sm'})}>
										<Cell mark={row.values[2]} />
									</td>
									<td className={b('td', {hide: 'sm'})}>
										<Cell mark={row.values[3]} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</motion.div>

				<div className={b('legend')}>
					<span className={b('legend-item')}>
						<CheckCircle size={14} weight="fill" className={b('legend-icon', {color: 'green'})} />
						{t('welcome_comparison.legend_yes')}
					</span>
					<span className={b('legend-item')}>
						<MinusCircle size={14} weight="fill" className={b('legend-icon', {color: 'yellow'})} />
						{t('welcome_comparison.legend_partial')}
					</span>
					<span className={b('legend-item')}>
						<XCircle size={14} weight="fill" className={b('legend-icon', {color: 'red'})} />
						{t('welcome_comparison.legend_no')}
					</span>
				</div>
			</div>
		</section>
	);
}
