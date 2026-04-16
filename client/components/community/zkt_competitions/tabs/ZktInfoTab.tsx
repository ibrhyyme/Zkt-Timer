import React from 'react';
import {useTranslation} from 'react-i18next';
import {b} from '../shared';
import {MapPin, Users, Calendar, User} from 'phosphor-react';

export default function ZktInfoTab({detail}: {detail: any}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	const approvedCount = detail.registrations.filter((r: any) => r.status === 'APPROVED').length;

	return (
		<div className={b('info-tab')}>
			<div className={b('info-grid')}>
				<div className={b('info-card')}>
					<Calendar weight="bold" />
					<div>
						<div className={b('info-label')}>{t('date')}</div>
						<div className={b('info-value')}>
							{new Date(detail.date_start).toLocaleDateString()} -{' '}
							{new Date(detail.date_end).toLocaleDateString()}
						</div>
					</div>
				</div>

				<div className={b('info-card')}>
					<MapPin weight="bold" />
					<div>
						<div className={b('info-label')}>{t('location')}</div>
						<div className={b('info-value')}>{detail.location}</div>
						{detail.location_address && (
							<div className={b('info-sub')}>{detail.location_address}</div>
						)}
					</div>
				</div>

				<div className={b('info-card')}>
					<Users weight="bold" />
					<div>
						<div className={b('info-label')}>{t('competitors')}</div>
						<div className={b('info-value')}>
							{approvedCount}
							{detail.competitor_limit && ` / ${detail.competitor_limit}`}
						</div>
					</div>
				</div>

				<div className={b('info-card')}>
					<User weight="bold" />
					<div>
						<div className={b('info-label')}>{t('organizer')}</div>
						<div className={b('info-value')}>{detail.created_by?.username || '-'}</div>
					</div>
				</div>
			</div>

			{detail.description && (
				<div className={b('description-block')}>
					<h3 className={b('section-title')}>{t('description')}</h3>
					<div className={b('description-text')}>{detail.description}</div>
				</div>
			)}

			{detail.delegates.length > 0 && (
				<div className={b('delegates-block')}>
					<h3 className={b('section-title')}>{t('delegates')}</h3>
					<div className={b('delegate-chips')}>
						{detail.delegates.map((d: any) => (
							<span key={d.id} className={b('delegate-chip')}>
								{d.user?.username || d.user_id}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
