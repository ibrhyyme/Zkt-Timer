import React from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';

const STATUS_MUTATION = gql`
	mutation UpdateZktCompStatus($input: UpdateZktCompetitionStatusInput!) {
		updateZktCompetitionStatus(input: $input) {
			id
			status
		}
	}
`;

const STATUS_FLOW: Record<string, string[]> = {
	DRAFT: ['ANNOUNCED'],
	ANNOUNCED: ['REGISTRATION_OPEN', 'DRAFT'],
	REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'ANNOUNCED'],
	REGISTRATION_CLOSED: ['ONGOING', 'REGISTRATION_OPEN'],
	ONGOING: ['FINISHED'],
	FINISHED: ['PUBLISHED'],
	PUBLISHED: [],
};

export default function DashboardOverview({detail, onUpdated}: {detail: any; onUpdated: () => void}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	const approvedCount = detail.registrations.filter((r: any) => r.status === 'APPROVED').length;
	const pendingCount = detail.registrations.filter((r: any) => r.status === 'PENDING').length;
	const nextStatuses = STATUS_FLOW[detail.status] || [];

	async function changeStatus(newStatus: string) {
		try {
			await gqlMutate(STATUS_MUTATION, {
				input: {competitionId: detail.id, status: newStatus},
			});
			toastSuccess(t('status_updated'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	return (
		<div className={b('overview')}>
			<div className={b('stat-grid')}>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('events')}</div>
					<div className={b('stat-value')}>{detail.events.length}</div>
				</div>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('approved_competitors')}</div>
					<div className={b('stat-value')}>
						{approvedCount}
						{detail.competitor_limit && ` / ${detail.competitor_limit}`}
					</div>
				</div>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('pending_registrations')}</div>
					<div className={b('stat-value')}>{pendingCount}</div>
				</div>
				<div className={b('stat')}>
					<div className={b('stat-label')}>{t('delegates')}</div>
					<div className={b('stat-value')}>{detail.delegates.length}</div>
				</div>
			</div>

			{detail.description && (
				<div className={b('description')}>
					<div className={b('section-title')}>{t('description')}</div>
					<div className={b('description-text')}>{detail.description}</div>
				</div>
			)}

			<div className={b('status-section')}>
				<div className={b('section-title')}>{t('change_status')}</div>
				<div className={b('current-status')}>
					{t('current_status')}: <strong>{t(`status_${detail.status.toLowerCase()}`)}</strong>
				</div>
				{nextStatuses.length > 0 ? (
					<div className={b('status-actions')}>
						{nextStatuses.map((s) => (
							<button
								key={s}
								className={b('status-btn', {[s.toLowerCase()]: true})}
								onClick={() => changeStatus(s)}
							>
								{t(`transition_to_${s.toLowerCase()}`)}
							</button>
						))}
					</div>
				) : (
					<div className={b('status-final')}>{t('status_final')}</div>
				)}
			</div>
		</div>
	);
}
