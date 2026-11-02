import React from 'react';
import {useTranslation} from 'react-i18next';
import {Trophy, Medal, Crown} from 'phosphor-react';
import block from '../../../styles/bem';
import {useZktBadge} from '../../../util/hooks/useZktBadge';
import {getZktOrigin} from '../../../../shared/integration';
import type {ZktPb} from '../zkt_pb_card/ZktPbCard';
import './ZktSummary.scss';

const b = block('zkt-summary');

export interface ZktProfileData {
	zkt_id?: string;
	zkt_name?: string;
	zkt_country_iso2?: string;
	zkt_competition_count?: number;
	zkt_medal_gold?: number;
	zkt_medal_silver?: number;
	zkt_medal_bronze?: number;
	zkt_record_count?: number;
	zkt_personal_bests?: ZktPb[];
	zkt_show_competitions?: boolean;
	zkt_show_medals?: boolean;
	zkt_show_records?: boolean;
	zkt_show_pbs?: boolean;
	zkt_show_rank?: boolean;
	zkt_show_results?: boolean;
	zkt_best_rank?: number;
	zkt_best_rank_event?: string;
}

interface Props {
	profile: ZktProfileData;
}

/**
 * The ZKT counterpart of WcaSummary: competitions, podium medals and standing
 * federation records. Sections the owner switched off arrive as null from the
 * server, so this component only has to decide what to draw, never what to hide.
 */
export default function ZktSummary({profile}: Props) {
	const {t} = useTranslation();
	const zktBadge = useZktBadge();

	if (!profile) return null;

	// A count is drawn only when it arrived: the server leaves it undefined both
	// for a switched-off section and when the federation could not answer (no
	// cached copy either). Defaulting to 0 there showed "0 competitions" for a
	// member with a full career.
	const showComps = profile.zkt_show_competitions !== false && profile.zkt_competition_count != null;
	const showMedals = profile.zkt_show_medals !== false;
	const showRecords = profile.zkt_show_records !== false;
	const bestRank = profile.zkt_show_rank !== false ? profile.zkt_best_rank : undefined;

	const medalTotal =
		(profile.zkt_medal_gold || 0) + (profile.zkt_medal_silver || 0) + (profile.zkt_medal_bronze || 0);
	const recordCount = profile.zkt_record_count || 0;

	// A member who has not competed yet has no ZKT ID and no numbers; the linked
	// account alone is not worth a card.
	if (!profile.zkt_id) return null;
	const hasMedals = showMedals && medalTotal > 0;
	const hasRecords = showRecords && recordCount > 0;
	if (!showComps && !hasMedals && !hasRecords && !bestRank) return null;

	return (
		<div className={b()}>
			<div className={b('header')}>
				{/* The federation badge, not the Zkt Timer mark: this card shows ZKT records. */}
				<img
					src={zktBadge}
					alt="Zeka Küpü Türkiye"
					className={b('logo')}
				/>
				<a
					href={`${getZktOrigin()}/cubers/${profile.zkt_id}`}
					target="_blank"
					rel="noopener noreferrer"
					className={b('zkt-id')}
				>
					{profile.zkt_id}
				</a>
				{/* Member number deliberately NOT shown: it is an operational handle
				    (the desk looks people up with it), it starts at zero — the first
				    members read as "#0" — and the ZKT ID beside it is already the
				    identity. The public profile query does not even carry it; only the
				    owner's own myZktProfile does. */}
			</div>

			<div className={b('stats')}>
				{showComps && (
					<div className={b('stat')}>
						<span className={b('stat-value')}>{profile.zkt_competition_count}</span>
						<span className={b('stat-label')}>{t('profile.zkt_competitions')}</span>
					</div>
				)}

				{hasMedals && (
					<div className={b('stat')}>
						<div className={b('medals')}>
							<span className={b('medal', {gold: true})}>
								<Crown weight="fill" /> {profile.zkt_medal_gold || 0}
							</span>
							<span className={b('medal', {silver: true})}>
								<Medal weight="fill" /> {profile.zkt_medal_silver || 0}
							</span>
							<span className={b('medal', {bronze: true})}>
								<Trophy weight="fill" /> {profile.zkt_medal_bronze || 0}
							</span>
						</div>
						<span className={b('stat-label')}>{t('profile.zkt_medals')}</span>
					</div>
				)}

				{hasRecords && (
					<div className={b('stat')}>
						<span className={b('record-badge')}>{recordCount}</span>
						<span className={b('stat-label')}>{t('profile.zkt_records')}</span>
					</div>
				)}

				{/* The ZKT counterpart of WcaSummary's best world rank. */}
				{bestRank && (
					<div className={b('stat')}>
						<span className={b('stat-value')}>#{bestRank}</span>
						<span className={b('stat-label')}>
							{t('profile.zkt_best_rank')}
							{profile.zkt_best_rank_event &&
								` (${t(`wca_events.${profile.zkt_best_rank_event}`, profile.zkt_best_rank_event)})`}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
