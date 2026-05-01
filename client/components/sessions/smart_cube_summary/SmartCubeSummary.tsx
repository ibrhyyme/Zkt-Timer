import React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSolves, FilterSolvesOptions } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { getTimeString } from '../../../util/time';
import Empty from '../../common/empty/Empty';
import block from '../../../styles/bem';
import './SmartCubeSummary.scss';

const b = block('smart-cube-summary');

interface Props {
	sessionId?: string;
	filterOptions?: FilterSolvesOptions;
}

function formatTotalDuration(totalSeconds: number, t: (k: string) => string): string {
	if (totalSeconds <= 0) return '–';
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	if (hours > 0) {
		return `${hours}${t('sessions.hours_short')} ${minutes}${t('sessions.minutes_short')}`;
	}
	if (minutes > 0) {
		return `${minutes}${t('sessions.minutes_short')} ${seconds}${t('sessions.seconds_short')}`;
	}
	return `${seconds}${t('sessions.seconds_short')}`;
}

export default function SmartCubeSummary({ sessionId, filterOptions }: Props) {
	const { t } = useTranslation();
	useSolveDb();

	if (!sessionId && !filterOptions) return null;

	const baseFilter = sessionId
		? { session_id: sessionId, is_smart_cube: true, dnf: false }
		: { ...filterOptions, is_smart_cube: true, dnf: false };

	const solves = fetchSolves(baseFilter);

	const count = solves.length;
	const totalSeconds = solves.reduce((sum, s) => sum + (s.time || 0), 0);
	const avgSeconds = count > 0 ? totalSeconds / count : 0;

	if (count === 0) {
		return (
			<div className={b()}>
				<Empty text={t('sessions.no_smart_cube_solves')} />
			</div>
		);
	}

	return (
		<div className={b()}>
			<div className={b('stats')}>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('sessions.smart_cube_count')}</div>
					<div className={b('stat-value')}>{count.toLocaleString()}</div>
				</div>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('sessions.smart_cube_total_time')}</div>
					<div className={b('stat-value')}>{formatTotalDuration(totalSeconds, t)}</div>
				</div>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('sessions.smart_cube_avg_time')}</div>
					<div className={b('stat-value')}>{getTimeString(avgSeconds)}</div>
				</div>
			</div>
		</div>
	);
}
