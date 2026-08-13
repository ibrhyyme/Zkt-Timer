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

interface ZktProfileData {
	zkt_id?: string | null;
	zkt_name?: string | null;
	zkt_avatar_url?: string | null;
	zkt_country_iso2?: string | null;
	zkt_competition_count?: number | null;
	zkt_medal_gold?: number | null;
	zkt_medal_silver?: number | null;
	zkt_medal_bronze?: number | null;
	zkt_personal_bests?: {event_id: string; single?: string | null; average?: string | null}[] | null;
	zkt_show_competitions?: boolean | null;
	zkt_show_medals?: boolean | null;
	zkt_show_pbs?: boolean | null;
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
	zktProfile?: ZktProfileData | null;
}

/** One result line on the card, whichever federation it came from. */
interface CardRecord {
	key: string;
	eventId: string;
	averageText: string | null;
	singleText: string | null;
	averageCountryRank?: number | null;
	averageWorldRank?: number | null;
	singleCountryRank?: number | null;
	singleWorldRank?: number | null;
}


/**
 * A federation avatar worth drawing. WCA hands out a grey silhouette when a
 * member never uploaded a photo, and the ZKT link inherits that URL for anyone
 * who joined through WCA — printing it puts an empty silhouette on a card the
 * member is about to share, while the initial badge at least carries their name.
 */
function realAvatar(url?: string | null): string | null {
	if (!url || /missing_avatar/i.test(url)) return null;
	return url;
}

function countryFlag(iso2?: string | null): string {
	if (!iso2 || iso2.length !== 2) return '';
	const codePoints = iso2
		.toUpperCase()
		.split('')
		.map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
}

export default function CuberCardCanvas({user, integration, records, zktProfile}: Props) {
	const {t} = useTranslation();

	// One card, one federation. A member with a WCA id gets the WCA card because
	// that is the career most people recognise; a ZKT-only member used to get an
	// empty card with a WCA badge on it, which claimed a federation they are not
	// in. The ZKT identity only counts once the federation has issued a ZKT id.
	const isZkt = !integration?.wca_id && !!zktProfile?.zkt_id;

	const avatarUrl =
		(user?.profile?.pfp_image?.storage_path ? getStorageURL(user.profile.pfp_image.storage_path) : null) ||
		realAvatar(isZkt ? zktProfile?.zkt_avatar_url : integration?.wca_avatar_url) ||
		null;

	const fullName =
		[user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() ||
		(isZkt ? zktProfile?.zkt_name : integration?.wca_name) ||
		user?.username ||
		'Cuber';

	const country = (isZkt ? zktProfile?.zkt_country_iso2 : integration?.wca_country_iso2) || null;
	const flag = countryFlag(country);
	const federationId = (isZkt ? zktProfile?.zkt_id : integration?.wca_id) || null;

	// Visibility flags — the owner's "manage data" toggles, per federation.
	const showCompetitions = isZkt
		? zktProfile?.zkt_show_competitions !== false
		: integration?.wca_show_competitions !== false;
	const showMedals = isZkt
		? zktProfile?.zkt_show_medals !== false
		: integration?.wca_show_medals !== false;
	const showRecords = isZkt
		? zktProfile?.zkt_show_pbs !== false
		: integration?.wca_show_records !== false;
	// ZKT results carry no world/country ranking yet, so the rank line is a
	// WCA-only detail rather than something hidden by a switch.
	const showRank = !isZkt && integration?.wca_show_rank !== false;

	const compCount = (isZkt ? zktProfile?.zkt_competition_count : integration?.wca_competition_count) ?? null;
	const goldCount = (isZkt ? zktProfile?.zkt_medal_gold : integration?.wca_medal_gold) ?? null;
	const silverCount = (isZkt ? zktProfile?.zkt_medal_silver : integration?.wca_medal_silver) ?? null;
	const bronzeCount = (isZkt ? zktProfile?.zkt_medal_bronze : integration?.wca_medal_bronze) ?? null;

	// The federation results are reduced to one shape before rendering: WCA sends
	// centisecond numbers plus ranks, ZKT sends strings the federation already
	// formatted (it owns the FMC/MBLD rules its own results were scored under).
	const recordsToShow: CardRecord[] = isZkt
		? (zktProfile?.zkt_personal_bests || [])
				.filter((pb) => pb.single || pb.average)
				.slice(0, 4)
				.map((pb) => ({
					key: pb.event_id,
					eventId: pb.event_id,
					averageText: pb.average || null,
					singleText: pb.single || null,
				}))
		: records
				.filter((r) => r.single_record || r.average_record)
				.slice(0, 4)
				.map((r) => ({
					key: r.id,
					eventId: r.wca_event,
					averageText: r.average_record ? formatResult(r.average_record, r.wca_event, true) : null,
					singleText: r.single_record ? formatResult(r.single_record, r.wca_event, false) : null,
					averageCountryRank: r.average_country_rank,
					averageWorldRank: r.average_world_rank,
					singleCountryRank: r.single_country_rank,
					singleWorldRank: r.single_world_rank,
				}));

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
					{federationId && (
						<>
							{flag && <span className={b('meta-sep')}>·</span>}
							<span className={b('wca-id')}>{federationId}</span>
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
							{/* The card is always dark, so the ZKT mark takes its light-lettered
							    file outright instead of following the app theme. */}
							<img
								src={resourceUri(isZkt ? '/images/zkt-logo.png' : '/images/logos/wca_logo.svg')}
								alt={isZkt ? 'ZKT' : 'WCA'}
								className={b('wca-logo')}
								crossOrigin="anonymous"
							/>
							<span className={b('records-badge-label')}>{t('profile.cuber_card_records')}</span>
						</div>
					</div>

					<div className={b('records-list')}>
						{recordsToShow.length === 0 && (
							<div className={b('no-records')}>—</div>
						)}
						{recordsToShow.map((r) => (
							<div key={r.key} className={b('record-row')}>
								<div className={b('record-icon-col')}>
									<EventIcon eventId={r.eventId} size={48} />
									<span className={b('record-event-label')}>{getEventName(r.eventId)}</span>
								</div>

								<div className={b('record-stat-col')}>
									<span className={b('record-stat-label')}>AVERAGE</span>
									<span className={b('record-stat-value', {empty: !r.averageText})}>
										{r.averageText || '—'}
									</span>
									{r.averageText && showRank && (
										<div className={b('record-ranks')}>
											{country && r.averageCountryRank && (
												<span className={b('record-rank')}>#{country} {r.averageCountryRank}</span>
											)}
											{r.averageWorldRank && (
												<span className={b('record-rank', {world: true})}>
													#{t('profile.wca_world_short')} {r.averageWorldRank}
												</span>
											)}
										</div>
									)}
								</div>

								<div className={b('record-stat-col')}>
									<span className={b('record-stat-label')}>SINGLE</span>
									<span className={b('record-stat-value', {empty: !r.singleText})}>
										{r.singleText || '—'}
									</span>
									{r.singleText && showRank && (
										<div className={b('record-ranks')}>
											{country && r.singleCountryRank && (
												<span className={b('record-rank')}>#{country} {r.singleCountryRank}</span>
											)}
											{r.singleWorldRank && (
												<span className={b('record-rank', {world: true})}>
													#{t('profile.wca_world_short')} {r.singleWorldRank}
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
