import React from 'react';
import {useTranslation} from 'react-i18next';
import {b, getEventName} from '../shared';
import {MapPin, Users, CalendarBlank, Trophy} from 'phosphor-react';
import MarkdownContent from '../MarkdownContent';

function openInMaps(query: string) {
	const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
	window.open(url, '_blank', 'noopener,noreferrer');
}

// OpenStreetMap embed (no dependency, SSR-safe).
function mapEmbedSrc(lat: number, lng: number): string {
	const d = 0.008;
	const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
	return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function PersonRow({user}: {user: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const avatar = user?.profile?.pfp_image?.url;
	return (
		<div className={b('info-person')}>
			{avatar ? (
				<img src={avatar} alt="" className={b('info-avatar')} />
			) : (
				<div className={b('info-avatar-placeholder')}>
					<Users size={16} />
				</div>
			)}
			<div className={b('info-person-text')}>
				<span className={b('info-name')}>{user?.username || t('unknown')}</span>
			</div>
		</div>
	);
}

export default function ZktInfoTab({detail}: {detail: any}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;
	const locationFull = [detail.location, detail.location_address].filter(Boolean).join(', ');

	const lat = detail.latitude;
	const lng = detail.longitude;
	const hasCoords = typeof lat === 'number' && typeof lng === 'number';

	const fmtDateTime = (iso?: string | null) =>
		iso ? new Date(iso).toLocaleString(locale, {dateStyle: 'medium', timeStyle: 'short'}) : '';

	const hasRegInfo =
		detail.registration_opens_at ||
		detail.registration_closes_at ||
		detail.registration_edit_deadline ||
		detail.on_spot_registration ||
		detail.cancellation_policy ||
		detail.guests_enabled === false;

	return (
		<div className={b('info-tab')}>
			{/* Description (markdown) */}
			{detail.description && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('description')}</h4>
					<div className={b('description-text')}>
						<MarkdownContent content={detail.description} />
					</div>
				</div>
			)}

			{/* Venue / Location + map */}
			{detail.location && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('venue')}</h4>
					<button
						type="button"
						className={b('info-venue-link')}
						onClick={() => openInMaps(locationFull || detail.location)}
					>
						<MapPin size={18} />
						<div>
							<span className={b('info-name')}>{detail.location}</span>
							{detail.location_address && (
								<span className={b('info-sub')}>{detail.location_address}</span>
							)}
						</div>
					</button>
					{hasCoords && (
						<div className={b('info-map')}>
							<iframe
								title="map"
								className={b('info-map-frame')}
								src={mapEmbedSrc(lat, lng)}
								loading="lazy"
							/>
						</div>
					)}
				</div>
			)}

			{/* Main event */}
			{detail.main_event_id && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('main_event')}</h4>
					<div className={b('info-main-event')}>
						<Trophy weight="fill" size={18} />
						<span className={`cubing-icon event-${detail.main_event_id}`} />
						<span className={b('info-name')}>{getEventName(detail.main_event_id)}</span>
					</div>
				</div>
			)}

			{/* Registration info */}
			{hasRegInfo && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('registration_info')}</h4>
					<div className={b('info-reg-list')}>
						{detail.registration_opens_at && (
							<div className={b('info-reg-row')}>
								<CalendarBlank size={15} />
								<span>{t('registration_opens')}: {fmtDateTime(detail.registration_opens_at)}</span>
							</div>
						)}
						{detail.registration_closes_at && (
							<div className={b('info-reg-row')}>
								<CalendarBlank size={15} />
								<span>{t('registration_closes')}: {fmtDateTime(detail.registration_closes_at)}</span>
							</div>
						)}
						{detail.registration_edit_deadline && (
							<div className={b('info-reg-row')}>
								<CalendarBlank size={15} />
								<span>
									{t('registration_edit_deadline')}: {fmtDateTime(detail.registration_edit_deadline)}
								</span>
							</div>
						)}
						{detail.on_spot_registration && (
							<div className={b('info-reg-row')}>{t('on_spot_allowed')}</div>
						)}
						{detail.guests_enabled === false && (
							<div className={b('info-reg-row')}>{t('guests_not_allowed')}</div>
						)}
					</div>
					{detail.cancellation_policy && (
						<div className={b('description-text')} style={{marginTop: '0.5rem'}}>
							<strong>{t('cancellation_policy')}:</strong> {detail.cancellation_policy}
						</div>
					)}
				</div>
			)}

			{/* Extra registration requirements (markdown) */}
			{detail.extra_requirements && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('extra_requirements')}</h4>
					<div className={b('description-text')}>
						<MarkdownContent content={detail.extra_requirements} />
					</div>
				</div>
			)}

			{/* Organizers (creator + added organizers) */}
			{(detail.created_by || (detail.organizers && detail.organizers.length > 0)) && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('organizers')}</h4>
					<div className={b('info-people-grid')}>
						{detail.created_by && <PersonRow user={detail.created_by} />}
						{(detail.organizers || []).map((o: any) => (
							<PersonRow key={o.id} user={o.user} />
						))}
					</div>
				</div>
			)}

			{/* Delegates */}
			{detail.delegates && detail.delegates.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('delegates')}</h4>
					<div className={b('info-people-grid')}>
						{detail.delegates.map((d: any) => (
							<PersonRow key={d.id} user={d.user} />
						))}
					</div>
				</div>
			)}

			{/* Contact (markdown) */}
			{detail.contact && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('contact')}</h4>
					<div className={b('description-text')}>
						<MarkdownContent content={detail.contact} />
					</div>
				</div>
			)}
		</div>
	);
}
