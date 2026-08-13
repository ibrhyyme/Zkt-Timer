import React from 'react';
import {useTranslation} from 'react-i18next';
import {Trophy, Medal, Crown} from 'phosphor-react';
import block from '../../../styles/bem';
import {resourceUri} from '../../../util/storage';
import {useTheme} from '../../../util/hooks/useTheme';
import {getZktOrigin} from '../../../../shared/integration';
import './ZktSummary.scss';

const b = block('zkt-summary');

export interface ZktProfileData {
	zkt_id?: string;
	zkt_name?: string;
	zkt_country_iso2?: string;
	zkt_member_no?: number;
	zkt_competition_count?: number;
	zkt_medal_gold?: number;
	zkt_medal_silver?: number;
	zkt_medal_bronze?: number;
	zkt_record_count?: number;
	zkt_personal_bests?: {event_id: string; single?: string; average?: string}[];
	zkt_show_competitions?: boolean;
	zkt_show_medals?: boolean;
	zkt_show_records?: boolean;
	zkt_show_pbs?: boolean;
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
	const isDarkTheme = useTheme('module_color')?.isDark !== false;

	if (!profile) return null;

	const showComps = profile.zkt_show_competitions !== false;
	const showMedals = profile.zkt_show_medals !== false;
	const showRecords = profile.zkt_show_records !== false;

	const medalTotal =
		(profile.zkt_medal_gold || 0) + (profile.zkt_medal_silver || 0) + (profile.zkt_medal_bronze || 0);
	const recordCount = profile.zkt_record_count || 0;

	// A member who has not competed yet has no ZKT ID and no numbers; the linked
	// account alone is not worth a card.
	if (!profile.zkt_id) return null;
	if (!showComps && !showMedals && !showRecords) return null;

	return (
		<div className={b()}>
			<div className={b('header')}>
				{/* Two files, one per theme: the ZKT artwork carries lettering that
				    has to invert with the surface. Same pair the header logo uses. */}
				<img
					src={resourceUri(isDarkTheme ? '/images/zkt-logo.png' : '/images/zkt-logo-white.png')}
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
				    identity. It stays available in the manage panel. */}
			</div>

			<div className={b('stats')}>
				{showComps && (
					<div className={b('stat')}>
						<span className={b('stat-value')}>{profile.zkt_competition_count ?? 0}</span>
						<span className={b('stat-label')}>{t('profile.zkt_competitions')}</span>
					</div>
				)}

				{showMedals && medalTotal > 0 && (
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

				{showRecords && recordCount > 0 && (
					<div className={b('stat')}>
						<span className={b('record-badge')}>{recordCount}</span>
						<span className={b('stat-label')}>{t('profile.zkt_records')}</span>
					</div>
				)}
			</div>
		</div>
	);
}
