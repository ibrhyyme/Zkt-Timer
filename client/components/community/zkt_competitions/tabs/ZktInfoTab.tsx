import React from 'react';
import {useTranslation} from 'react-i18next';
import {b, getEventName} from '../shared';
import {MapPin, Users, Trophy} from 'phosphor-react';
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

function PersonRow({name}: {name: string}) {
	return (
		<div className={b('info-person')}>
			<div className={b('info-avatar-placeholder')}>
				<Users size={16} />
			</div>
			<div className={b('info-person-text')}>
				<span className={b('info-name')}>{name}</span>
			</div>
		</div>
	);
}

export default function ZktInfoTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locationFull = [detail.location, detail.locationAddress].filter(Boolean).join(', ');

	const lat = detail.latitude;
	const lng = detail.longitude;
	const hasCoords = typeof lat === 'number' && typeof lng === 'number';

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
							{detail.locationAddress && (
								<span className={b('info-sub')}>{detail.locationAddress}</span>
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
			{detail.mainEventId && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('main_event')}</h4>
					<div className={b('info-main-event')}>
						<Trophy weight="fill" size={18} />
						<span className={`cubing-icon event-${detail.mainEventId}`} />
						<span className={b('info-name')}>{getEventName(detail.mainEventId)}</span>
					</div>
				</div>
			)}

			{/* Organizers */}
			{detail.organizers && detail.organizers.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('organizers')}</h4>
					<div className={b('info-people-grid')}>
						{detail.organizers.map((o: any, i: number) => (
							<PersonRow key={i} name={o.name} />
						))}
					</div>
				</div>
			)}

			{/* Delegates */}
			{detail.delegates && detail.delegates.length > 0 && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('delegates')}</h4>
					<div className={b('info-people-grid')}>
						{detail.delegates.map((d: any, i: number) => (
							<PersonRow key={i} name={d.name} />
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
