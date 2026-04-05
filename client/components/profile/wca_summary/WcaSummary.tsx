import React from 'react';
import { useTranslation } from 'react-i18next';
import './WcaSummary.scss';
import { Trophy, Medal, Crown } from 'phosphor-react';
import block from '../../../styles/bem';
import { resourceUri } from '../../../util/storage';

const b = block('wca-summary');

interface WcaIntegrationData {
	wca_id?: string;
	wca_country_iso2?: string;
	wca_competition_count?: number;
	wca_medal_gold?: number;
	wca_medal_silver?: number;
	wca_medal_bronze?: number;
	wca_record_nr?: number;
	wca_record_cr?: number;
	wca_record_wr?: number;
	wca_show_competitions?: boolean;
	wca_show_medals?: boolean;
	wca_show_records?: boolean;
	wca_show_rank?: boolean;
}

interface Props {
	integration: WcaIntegrationData;
	bestWorldRank?: number;
	bestWorldRankEvent?: string;
}

export default function WcaSummary({ integration, bestWorldRank, bestWorldRankEvent }: Props) {
	const { t } = useTranslation();

	if (!integration) return null;

	const {
		wca_id,
		wca_competition_count,
		wca_medal_gold,
		wca_medal_silver,
		wca_medal_bronze,
		wca_record_nr,
		wca_record_cr,
		wca_record_wr,
		wca_show_competitions,
		wca_show_medals,
		wca_show_records,
		wca_show_rank,
	} = integration;

	const showComps = wca_show_competitions !== false;
	const showMedals = wca_show_medals !== false;
	const showRecords = wca_show_records !== false;
	const showRank = wca_show_rank !== false;

	const totalRecords = (wca_record_nr || 0) + (wca_record_cr || 0) + (wca_record_wr || 0);

	// Hicbir sey gosterilmiyorsa karti gizle
	if (!showComps && !showMedals && !showRecords && !showRank) return null;

	return (
		<div className={b()}>
			<div className={b('header')}>
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					className={b('logo')}
				/>
				{wca_id && (
					<a
						href={`https://www.worldcubeassociation.org/persons/${wca_id}`}
						target="_blank"
						rel="noopener noreferrer"
						className={b('wca-id')}
					>
						{wca_id}
					</a>
				)}
			</div>

			<div className={b('stats')}>
				{showComps && (
					<div className={b('stat')}>
						<span className={b('stat-value')}>{wca_competition_count ?? 0}</span>
						<span className={b('stat-label')}>{t('profile.wca_competitions')}</span>
					</div>
				)}

				{showMedals && (
					<div className={b('stat')}>
						<div className={b('medals')}>
							<span className={b('medal', { gold: true })}>
								<Crown weight="fill" /> {wca_medal_gold || 0}
							</span>
							<span className={b('medal', { silver: true })}>
								<Medal weight="fill" /> {wca_medal_silver || 0}
							</span>
							<span className={b('medal', { bronze: true })}>
								<Trophy weight="fill" /> {wca_medal_bronze || 0}
							</span>
						</div>
						<span className={b('stat-label')}>{t('profile.wca_medals')}</span>
					</div>
				)}

				{showRecords && totalRecords > 0 && (
					<div className={b('stat')}>
						<div className={b('records-list')}>
							{wca_record_wr > 0 && <span className={b('record-badge', { wr: true })}>{wca_record_wr} WR</span>}
							{wca_record_cr > 0 && <span className={b('record-badge', { cr: true })}>{wca_record_cr} CR</span>}
							{wca_record_nr > 0 && <span className={b('record-badge', { nr: true })}>{wca_record_nr} NR</span>}
						</div>
						<span className={b('stat-label')}>{t('profile.wca_national_records')}</span>
					</div>
				)}

				{showRank && bestWorldRank && (
					<div className={b('stat')}>
						<span className={b('stat-value')}>#{bestWorldRank}</span>
						<span className={b('stat-label')}>
							{t('profile.wca_world_rank')}
							{bestWorldRankEvent && ` (${t(`wca_events.${bestWorldRankEvent}`, bestWorldRankEvent)})`}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
