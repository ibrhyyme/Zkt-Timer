import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName} from '../shared';
import {Check, X, Clock, UserPlus, DownloadSimple, UploadSimple, Trash} from 'phosphor-react';
import fileDownload from 'js-file-download';
import AddCompetitorModal from './AddCompetitorModal';
import ImportCompetitorsModal from './ImportCompetitorsModal';
import {useDispatch} from 'react-redux';
import {openModal} from '../../../../actions/general';

const UPDATE_STATUS = gql`
	mutation UpdateZktRegStatus($input: UpdateZktRegistrationStatusInput!) {
		updateZktRegistrationStatus(input: $input) {
			id
			status
			waiting_list_position
		}
	}
`;

const BULK_UPDATE = gql`
	mutation BulkUpdateZktRegs($input: BulkUpdateZktRegistrationsInput!) {
		bulkUpdateZktRegistrations(input: $input) {
			id
			status
			waiting_list_position
		}
	}
`;

const DELETE_REGISTRATION = gql`
	mutation DeleteZktRegistration($registrationId: String!) {
		deleteZktRegistration(registrationId: $registrationId)
	}
`;

const DELETE_ALL_REGISTRATIONS = gql`
	mutation DeleteAllZktRegistrations($competitionId: String!) {
		deleteAllZktRegistrations(competitionId: $competitionId)
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
	const [eventFilter, setEventFilter] = useState<string>(''); // comp_event.id or ''
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

	async function deleteRow(registrationId: string) {
		if (!window.confirm(t('delete_registration_confirm'))) return;
		try {
			await gqlMutate(DELETE_REGISTRATION, {registrationId});
			toastSuccess(t('registration_deleted'));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function deleteAll() {
		const total = detail.registrations.length;
		if (total === 0) return;
		if (!window.confirm(t('delete_all_confirm', {count: total}))) return;
		try {
			const res = await gqlMutate(DELETE_ALL_REGISTRATIONS, {competitionId: detail.id});
			toastSuccess(t('all_deleted', {count: res?.data?.deleteAllZktRegistrations ?? total}));
			setSelected(new Set());
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function bulkSetStatus(status: string) {
		try {
			const updates = Array.from(selected).map((registrationId) => ({
				registrationId,
				status,
			}));
			await gqlMutate(BULK_UPDATE, {
				input: {competitionId: detail.id, updates},
			});
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

	function openImportModal() {
		dispatch(
			openModal(
				<ImportCompetitorsModal
					competitionId={detail.id}
					compEvents={detail.events}
					onComplete={onUpdated}
				/>
			)
		);
	}

	const filtered = detail.registrations.filter((r: any) => {
		if (filter && r.status !== filter) return false;
		if (eventFilter && !(r.events || []).some((e: any) => e.comp_event_id === eventFilter))
			return false;
		return true;
	});

	// Count by status
	const counts: Record<string, number> = {};
	for (const r of detail.registrations) {
		counts[r.status] = (counts[r.status] || 0) + 1;
	}
	const totalCount = detail.registrations.length;

	// Count by event (how many competitors registered for each event) + how many
	// are in 2+ events ("kaç tanesi her ikisinde de yarışıyor").
	const eventCounts: Record<string, number> = {};
	for (const r of detail.registrations) {
		for (const e of r.events || []) {
			eventCounts[e.comp_event_id] = (eventCounts[e.comp_event_id] || 0) + 1;
		}
	}
	const multiEventCount = detail.registrations.filter(
		(r: any) => (r.events || []).length >= 2
	).length;

	// Map compEventId -> event_id
	const compEventMap = new Map<string, string>();
	detail.events.forEach((e: any) => compEventMap.set(e.id, e.event_id));

	function exportCsv() {
		const cell = (v: any) => {
			const s = String(v ?? '');
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		const header = [
			t('csv_username'),
			t('csv_name'),
			t('csv_country'),
			t('csv_status'),
			t('csv_registered'),
			t('csv_events'),
		];
		const rows = detail.registrations.map((r: any) => {
			const events = (r.events || [])
				.map((e: any) => compEventMap.get(e.comp_event_id))
				.filter(Boolean)
				.map((eid: string) => getEventName(eid))
				.join('; ');
			const fullName =
				[r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') ||
				[r.person?.first_name, r.person?.last_name].filter(Boolean).join(' ');
			return [
				r.user?.username || '',
				fullName,
				r.user?.join_country || r.person?.country_code || '',
				t(`registration_${r.status.toLowerCase()}`),
				r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
				events,
			];
		});
		const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
		// Prepend BOM so Excel reads UTF-8 (Turkish chars) correctly.
		fileDownload('﻿' + csv, `${detail.name.replace(/\s+/g, '_')}-kayitlar.csv`);
	}

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

			{detail.events.length > 1 && (
				<div className={b('filter-tabs')}>
					<button
						className={b('filter-pill', {active: eventFilter === ''})}
						onClick={() => setEventFilter('')}
					>
						<span>{t('filter_all_events')}</span>
						<span className={b('filter-pill-count')}>{totalCount}</span>
					</button>
					{detail.events.map((ev: any) => (
						<button
							key={ev.id}
							className={b('filter-pill', {active: eventFilter === ev.id})}
							onClick={() => setEventFilter(ev.id)}
						>
							<span className={`cubing-icon event-${ev.event_id}`} />
							<span>{getEventName(ev.event_id)}</span>
							<span className={b('filter-pill-count')}>{eventCounts[ev.id] || 0}</span>
						</button>
					))}
				</div>
			)}

			{detail.events.length > 1 && multiEventCount > 0 && (
				<div
					style={{
						fontSize: 13,
						color: 'rgb(var(--text-color))',
						margin: '0 0 0.75rem 0.25rem',
					}}
				>
					{t('multi_event_summary', {count: multiEventCount})}
				</div>
			)}

			<div className={b('toolbar')}>
				<button className={b('action-btn')} onClick={exportCsv} title={t('export_csv')}>
					<DownloadSimple weight="bold" /> {t('export_csv')}
				</button>
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
					<>
						<button className={b('create-btn')} onClick={openAddModal}>
							<UserPlus weight="bold" /> {t('add_competitor')}
						</button>
						<button className={b('create-btn', {ghost: true})} onClick={openImportModal}>
							<UploadSimple weight="bold" /> {t('import_competitors')}
						</button>
						{totalCount > 0 && (
							<button
								className={b('action-btn', {delete: true})}
								style={{marginLeft: 'auto'}}
								onClick={deleteAll}
								title={t('delete_all_competitors')}
							>
								<Trash weight="bold" /> {t('delete_all_competitors')}
							</button>
						)}
					</>
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
									{reg.user?.username ||
										[reg.person?.first_name, reg.person?.last_name]
											.filter(Boolean)
											.join(' ')
											.trim() ||
										reg.user_id ||
										reg.person_id}
									{reg.person && (
										<span className={b('ghost-badge')}>{t('ghost_competitor')}</span>
									)}
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
								<button
									className={b('action-btn', {delete: true})}
									onClick={() => deleteRow(reg.id)}
									title={t('delete_registration')}
								>
									<Trash weight="bold" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
