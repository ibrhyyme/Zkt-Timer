import React from 'react';
import {useTranslation} from 'react-i18next';
import {b} from '../shared';
import {MapPin, Users} from 'phosphor-react';

function openInMaps(query: string) {
	const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
	window.open(url, '_blank', 'noopener,noreferrer');
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
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locationFull = [detail.location, detail.location_address].filter(Boolean).join(', ');

	return (
		<div className={b('info-tab')}>
			{/* Description top — markdown desteği yoksa düz metin */}
			{detail.description && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('description')}</h4>
					<div className={b('description-text')}>{detail.description}</div>
				</div>
			)}

			{/* Venue / Location — WCA InfoTab pattern */}
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
				</div>
			)}

			{/* Organizer (creator) */}
			{detail.created_by && (
				<div className={b('info-section')}>
					<h4 className={b('info-section-title')}>{t('organizer')}</h4>
					<PersonRow user={detail.created_by} />
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
		</div>
	);
}
