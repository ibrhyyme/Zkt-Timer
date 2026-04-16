import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName} from '../shared';
import {Check, X, Clock, UserPlus} from 'phosphor-react';
import AddCompetitorModal from './AddCompetitorModal';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../../actions/general';

const UPDATE_STATUS = gql`
	mutation UpdateZktRegStatus($input: UpdateZktRegistrationStatusInput!) {
		updateZktRegistrationStatus(input: $input) {
			id
			status
		}
	}
`;

const STATUSES: Array<{id: string; key: string}> = [
	{id: '', key: 'filter_all'},
	{id: 'PENDING', key: 'registration_pending'},
	{id: 'APPROVED', key: 'registration_approved'},
	{id: 'WAITLISTED', key: 'registration_waitlisted'},
	{id: 'REJECTED', key: 'registration_rejected'},
	{id: 'WITHDRAWN', key: 'registration_withdrawn'},
];

export default function DashboardRegistrations({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const dispatch = useDispatch();
	const [filter, setFilter] = useState<string>('');
	const [selected, setSelected] = useState<Set<string>>(new Set());

	async function setStatus(registrationId: string, status: string) {
		try {
			await gqlMutate(UPDATE_STATUS, {input: {registrationId, status}});
			toastSuccess(t('updated'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function bulkSetStatus(status: string) {
		try {
			await Promise.all(
				Array.from(selected).map((registrationId) =>
					gqlMutate(UPDATE_STATUS, {input: {registrationId, status}})
				)
			);
			toastSuccess(t('bulk_updated'));
			setSelected(new Set());
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	function toggleSelected(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelected(next);
	}

	function openAddModal() {
		dispatch(
			openModal(
				<AddCompetitorModal
					competitionId={detail.id}
					compEvents={detail.events}
					onComplete={onUpdated}
				/>
			)
		);
	}

	const filtered = filter
		? detail.registrations.filter((r: any) => r.status === filter)
		: detail.registrations;

	// Count by status
	const counts: Record<string, number> = {};
	for (const r of detail.registrations) {
		counts[r.status] = (counts[r.status] || 0) + 1;
	}
	const totalCount = detail.registrations.length;

	// Map compEventId -> event_id
	const compEventMap = new Map<string, string>();
	detail.events.forEach((e: any) => compEventMap.set(e.id, e.event_id));

	return (
		<div className={b('registrations')}>
			<div className={b('filter-tabs')}>
				{STATUSES.map((s) => {
					const count = s.id === '' ? totalCount : counts[s.id] || 0;
					return (
						<button
							key={s.id || 'all'}
							className={b('filter-pill', {active: filter === s.id})}
							onClick={() => setFilter(s.id)}
						>
							<span>{t(s.key)}</span>
							<span className={b('filter-pill-count')}>{count}</span>
						</button>
					);
				})}
			</div>

			<div className={b('toolbar')}>
				{selected.size > 0 ? (
					<>
						<span style={{marginRight: 'auto', fontWeight: 600}}>
							{t('selected_count', {count: selected.size})}
						</span>
						<button
							className={b('action-btn', {approve: true})}
							onClick={() => bulkSetStatus('APPROVED')}
						>
							<Check weight="bold" /> {t('approve_all')}
						</button>
						<button
							className={b('action-btn', {reject: true})}
							onClick={() => bulkSetStatus('REJECTED')}
						>
							<X weight="bold" /> {t('reject_all')}
						</button>
						<button
							className={b('action-btn', {waitlist: true})}
							onClick={() => bulkSetStatus('WAITLISTED')}
						>
							<Clock weight="bold" /> {t('waitlist_all')}
						</button>
					</>
				) : (
					<button className={b('create-btn')} onClick={openAddModal}>
						<UserPlus weight="bold" /> {t('add_competitor')}
					</button>
				)}
			</div>

			{filtered.length === 0 ? (
				<div className={b('empty')}>{t('no_registrations')}</div>
			) : (
				<div className={b('reg-list')}>
					{filtered.map((reg: any) => (
						<div key={reg.id} className={b('reg-row')}>
							<label style={{display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
								<input
									type="checkbox"
									checked={selected.has(reg.id)}
									onChange={() => toggleSelected(reg.id)}
								/>
								{reg.user?.profile?.pfp_image?.url && (
									<img
										className={b('user-avatar')}
										src={reg.user.profile.pfp_image.url}
										alt=""
									/>
								)}
								<span className={b('user-name')}>
									{reg.user?.username || reg.user_id}
								</span>
							</label>

							<div className={b('reg-events')}>
								{reg.events.map((e: any) => {
									const eventId = compEventMap.get(e.comp_event_id);
									if (!eventId) return null;
									return (
										<span
											key={e.id}
											className={b('event-chip')}
											title={getEventName(eventId)}
										>
											<span className={`cubing-icon event-${eventId}`} />
										</span>
									);
								})}
							</div>

							<span className={b('status', {[reg.status.toLowerCase()]: true})}>
								{t(`registration_${reg.status.toLowerCase()}`)}
							</span>

							<div className={b('reg-actions')}>
								{reg.status !== 'APPROVED' && (
									<button
										className={b('action-btn', {approve: true})}
										onClick={() => setStatus(reg.id, 'APPROVED')}
										title={t('approve')}
									>
										<Check weight="bold" />
									</button>
								)}
								{reg.status !== 'WAITLISTED' && (
									<button
										className={b('action-btn', {waitlist: true})}
										onClick={() => setStatus(reg.id, 'WAITLISTED')}
										title={t('waitlist')}
									>
										<Clock weight="bold" />
									</button>
								)}
								{reg.status !== 'REJECTED' && (
									<button
										className={b('action-btn', {reject: true})}
										onClick={() => setStatus(reg.id, 'REJECTED')}
										title={t('reject')}
									>
										<X weight="bold" />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
