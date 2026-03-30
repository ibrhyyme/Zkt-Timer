import React from 'react';
import './UserSummary.scss';
import block from '../../../../styles/bem';
import {UserAccountSolvesSummary, UserAccountSummary} from '../../../../../server/schemas/UserAccount.schema';
import {getCubeTypeInfoById} from '../../../../util/cubes/util';
import {getTimeString} from '../../../../util/time';
import {useTranslation} from 'react-i18next';

const b = block('manage-user-summary');

interface Props {
	summary: UserAccountSummary;
}

export default function UserSummary(props: Props) {
	const {summary} = props;
	const {t} = useTranslation('translation', {keyPrefix: 'admin_users.manage_user'});

	if (!summary) {
		return <div className={b()}>{t('no_data')}</div>;
	}

	function getPill(title: string, value: string) {
		return (
			<div className={b('pill')}>
				<span className={b('pill-title')}>{title}</span>
				<span className={b('pill-value')}>{value}</span>
			</div>
		);
	}

	function getSummarySection(cubeTypes: UserAccountSolvesSummary[]) {
		if (!cubeTypes || !cubeTypes.length) {
			return (
				<div className={b('solve-cubetype')}>
					<span>{t('no_data')}</span>
				</div>
			);
		}

		return cubeTypes.map((ct) => {
			const cubeType = getCubeTypeInfoById(ct.cube_type);

			return (
				<div key={`timer-ss-${cubeType.id}`} className={b('solve-cubetype')}>
					<h4>{cubeType.name}</h4>
					<div className={b('pills')}>
						{getPill(t('solves_count'), ct.count.toLocaleString())}
						{getPill(t('total_time'), getTimeString(ct.sum, 2))}
						{getPill(t('average'), getTimeString(ct.average, 2))}
						{getPill(t('min_time'), getTimeString(ct.min_time, 2))}
						{getPill(t('max_time'), getTimeString(ct.max_time, 2))}
					</div>
				</div>
			);
		});
	}

	return (
		<div className={b()}>
			<div className={b('section')}>
				<h3>{t('overview')}</h3>
				<div className={b('pills')}>
					{getPill(t('solves_count'), summary.solves.toLocaleString())}
					{getPill(t('bans_count'), summary.bans.toLocaleString())}
					{getPill(t('reports_received'), summary.reports_for.toLocaleString())}
					{getPill(t('reports_created'), summary.reports_created.toLocaleString())}
				</div>
			</div>
			<div className={b('section')}>
				<h3>{t('timer_solves')}</h3>
				{getSummarySection(summary.timer_solves)}
			</div>
		</div>
	);
}
