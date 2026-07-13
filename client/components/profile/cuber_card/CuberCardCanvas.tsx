import React from 'react';
import {useTranslation} from 'react-i18next';
import {Trophy, Medal, Crown, Calendar} from 'phosphor-react';
import block from '../../../styles/bem';
import {EventIcon, formatResult} from '../../community/my_schedule/shared';
import {getStorageURL, resourceUri} from '../../../util/storage';
import './CuberCardCanvas.scss';

const b = block('cuber-card-canvas');

interface WcaRecord {
	id: string;
	wca_event: string;
	single_record?: number;
	average_record?: number;
	single_world_rank?: number;
	average_world_rank?: number;
	single_country_rank?: number;
	average_country_rank?: number;
}

interface IntegrationData {
	wca_id?: string | null;
	wca_name?: string | null;
	wca_avatar_url?: string | null;
	wca_country_iso2?: string | null;
	wca_competition_count?: number | null;
	wca_medal_gold?: number | null;
	wca_medal_silver?: number | null;
	wca_medal_bronze?: number | null;
	wca_show_competitions?: boolean | null;
	wca_show_medals?: boolean | null;
	wca_show_records?: boolean | null;
	wca_show_rank?: boolean | null;
}

interface UserLike {
	username?: string;
	first_name?: string;
	last_name?: string;
	profile?: {pfp_image?: {storage_path: string} | null} | null;
}

interface Props {
	user: UserLike;
	integration?: IntegrationData | null;
	records: WcaRecord[];
}


function countryFlag(iso2?: string | null): string {
	if (!iso2 || iso2.length !== 2) return '';
	const codePoints = iso2
		.toUpperCase()
		.split('')
		.map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
}

export default function CuberCardCanvas({user, integration, records}: Props) {
	const {t} = useTranslation();

	const avatarUrl =
		(user?.profile?.pfp_image?.storage_path ? getStorageURL(user.profile.pfp_image.storage_path) : null) ||
		integration?.wca_avatar_url ||
		null;

	const fullName =
		[user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
		integration?.wca_name ||
		user?.username ||
		'Cuber';

	const country = integration?.wca_country_iso2 || null;
	const flag = countryFlag(country);

	// Visibility flags — kullanıcının "WCA Verilerini Yönet" toggle'ları
	const showCompetitions = integration?.wca_show_competitions !== false;
	const showMedals = integration?.wca_show_medals !== false;
	const showRecords = integration?.wca_show_records !== false;
	const showRank = integration?.wca_show_rank !== false;

	const compCount = integration?.wca_competition_count ?? null;
	const goldCount = integration?.wca_medal_gold ?? null;
	const silverCount = integration?.wca_medal_silver ?? null;
	const bronzeCount = integration?.wca_medal_bronze ?? null;

	const visibleRecords = records.filter((r) => r.single_record || r.average_record);
	const recordsToShow = visibleRecords.slice(0, 4);

	// Stats row — competition + medals
	const statBoxes: {key: string; value: number; label: string; color: string; Icon: any}[] = [];
	if (showCompetitions && typeof compCount === 'number') {
		statBoxes.push({key: 'comp', value: compCount, label: t('profile.cuber_card_stat_competitions'), color: '#a78bfa', Icon: Calendar});
	}
	if (showMedals) {
		if (typeof goldCount === 'number') statBoxes.push({key: 'gold', value: goldCount, label: t('profile.cuber_card_stat_gold'), color: '#fbbf24', Icon: Crown});
		if (typeof silverCount === 'number') statBoxes.push({key: 'silver', value: silverCount, label: t('profile.cuber_card_stat_silver'), color: '#e5e7eb', Icon: Medal});
		if (typeof bronzeCount === 'number') statBoxes.push({key: 'bronze', value: bronzeCount, label: t('profile.cuber_card_stat_bronze'), color: '#fb923c', Icon: Trophy});
	}

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	return (
		<div className={b()}>
			<div className={b('glow-1')} />
			<div className={b('glow-2')} />

			{/* Header */}
			<div className={b('header')}>
				<div className={b('avatar-wrap')}>
					{avatarUrl ? (
						<img src={avatarUrl} alt="" className={b('avatar')} crossOrigin="anonymous" />
					) : (
						<div className={b('avatar-placeholder')}>
							{(fullName.charAt(0) || '?').toUpperCase()}
						</div>
					)}
				</div>

				<h1 className={b('name')}>{fullName}</h1>

				<div className={b('meta')}>
					{flag && <span className={b('flag')}>{flag}</span>}
					{integration?.wca_id && (
						<>
							{flag && <span className={b('meta-sep')}>·</span>}
							<span className={b('wca-id')}>{integration.wca_id}</span>
						</>
					)}
				</div>
			</div>

			{/* Stats Row — yarışma + madalyalar */}
			{statBoxes.length > 0 && (
				<div className={b('stats-row')}>
					{statBoxes.map((s) => (
						<div key={s.key} className={b('stat-box')} data-color={s.key}>
							<span className={b('stat-value')} style={{color: s.color}}>{s.value}</span>
							<div className={b('stat-label-row')}>
								<s.Icon weight="fill" className={b('stat-icon')} style={{color: s.color}} />
								<span className={b('stat-label')}>{s.label}</span>
							</div>
							<div className={b('stat-glow')} style={{background: `linear-gradient(90deg, transparent 0%, ${s.color} 50%, transparent 100%)`}} />
						</div>
					))}
				</div>
			)}

			{/* Records */}
			{showRecords && (
				<div className={b('records-section')}>
					<div className={b('records-header')}>
						<div className={b('records-badge')}>
							<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-logo')} crossOrigin="anonymous" />
							<span className={b('records-badge-label')}>{t('profile.cuber_card_records')}</span>
						</div>
					</div>

					<div className={b('records-list')}>
						{recordsToShow.length === 0 && (
							<div className={b('no-records')}>—</div>
						)}
						{recordsToShow.map((r) => (
							<div key={r.id} className={b('record-row')}>
								<div className={b('record-icon-col')}>
									<EventIcon eventId={r.wca_event} size={48} />
									<span className={b('record-event-label')}>{getEventName(r.wca_event)}</span>
								</div>

								<div className={b('record-stat-col')}>
									<span className={b('record-stat-label')}>AVERAGE</span>
									<span className={b('record-stat-value', {empty: !r.average_record})}>
										{formatResult(r.average_record ?? 0, r.wca_event, true)}
									</span>
									{r.average_record && showRank && (
										<div className={b('record-ranks')}>
											{country && r.average_country_rank && (
												<span className={b('record-rank')}>#{country} {r.average_country_rank}</span>
											)}
											{r.average_world_rank && (
												<span className={b('record-rank', {world: true})}>
													#{t('profile.wca_world_short')} {r.average_world_rank}
												</span>
											)}
										</div>
									)}
								</div>

								<div className={b('record-stat-col')}>
									<span className={b('record-stat-label')}>SINGLE</span>
									<span className={b('record-stat-value', {empty: !r.single_record})}>
										{formatResult(r.single_record ?? 0, r.wca_event, false)}
									</span>
									{r.single_record && showRank && (
										<div className={b('record-ranks')}>
											{country && r.single_country_rank && (
												<span className={b('record-rank')}>#{country} {r.single_country_rank}</span>
											)}
											{r.single_world_rank && (
												<span className={b('record-rank', {world: true})}>
													#{t('profile.wca_world_short')} {r.single_world_rank}
												</span>
											)}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className={b('watermark')}>zktimer.app</div>
		</div>
	);
}
