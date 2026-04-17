import React, {useEffect, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';
import {Plus, Check, X, Pencil, Trash} from 'phosphor-react';

const REPORT_QUERY = gql`
	query DashboardDelegateReport($competitionId: String!) {
		zktDelegateReport(competitionId: $competitionId) {
			id
			summary
			venue_notes
			organization_notes
			incidents_summary
			remarks
			submitted_at
			submitted_by_id
			submitted_by {
				username
			}
		}
	}
`;

const INCIDENTS_QUERY = gql`
	query DashboardIncidents($competitionId: String!) {
		zktIncidents(competitionId: $competitionId) {
			id
			title
			description
			tags
			resolved_at
			created_at
			created_by {
				username
			}
		}
	}
`;

const UPSERT_REPORT = gql`
	mutation UpsertZktDelegateReport($input: UpsertZktDelegateReportInput!) {
		upsertZktDelegateReport(input: $input) {
			id
		}
	}
`;

const SUBMIT_REPORT = gql`
	mutation SubmitZktDelegateReport($competitionId: String!) {
		submitZktDelegateReport(competitionId: $competitionId) {
			id
			submitted_at
		}
	}
`;

const CREATE_INCIDENT = gql`
	mutation CreateZktIncident($input: CreateZktIncidentInput!) {
		createZktIncident(input: $input) {
			id
		}
	}
`;

const UPDATE_INCIDENT = gql`
	mutation UpdateZktIncident($input: UpdateZktIncidentInput!) {
		updateZktIncident(input: $input) {
			id
			resolved_at
		}
	}
`;

const DELETE_INCIDENT = gql`
	mutation DeleteZktIncident($id: String!) {
		deleteZktIncident(id: $id)
	}
`;

export default function DashboardDelegateReport({
	detail,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [report, setReport] = useState<any>(null);
	const [incidents, setIncidents] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const [summary, setSummary] = useState('');
	const [venueNotes, setVenueNotes] = useState('');
	const [orgNotes, setOrgNotes] = useState('');
	const [incidentsSummary, setIncidentsSummary] = useState('');
	const [remarks, setRemarks] = useState('');

	async function load() {
		setLoading(true);
		try {
			const [repRes, incRes] = await Promise.all([
				gqlMutate(REPORT_QUERY, {competitionId: detail.id}),
				gqlMutate(INCIDENTS_QUERY, {competitionId: detail.id}),
			]);
			const r = (repRes as any)?.data?.zktDelegateReport;
			setReport(r);
			setSummary(r?.summary ?? '');
			setVenueNotes(r?.venue_notes ?? '');
			setOrgNotes(r?.organization_notes ?? '');
			setIncidentsSummary(r?.incidents_summary ?? '');
			setRemarks(r?.remarks ?? '');
			setIncidents((incRes as any)?.data?.zktIncidents || []);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, [detail.id]);

	async function saveReport() {
		setSaving(true);
		try {
			await gqlMutate(UPSERT_REPORT, {
				input: {
					competitionId: detail.id,
					summary,
					venueNotes,
					organizationNotes: orgNotes,
					incidentsSummary,
					remarks,
				},
			});
			toastSuccess(t('saved'));
			await load();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	async function submitReport() {
		if (!window.confirm(t('submit_report_confirm'))) return;
		setSaving(true);
		try {
			await gqlMutate(SUBMIT_REPORT, {competitionId: detail.id});
			toastSuccess(t('report_submitted'));
			await load();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	async function addIncident() {
		const title = window.prompt(t('incident_title_prompt'));
		if (!title || !title.trim()) return;
		const description = window.prompt(t('incident_description_prompt')) || '';
		try {
			await gqlMutate(CREATE_INCIDENT, {
				input: {
					competitionId: detail.id,
					title: title.trim(),
					description,
				},
			});
			toastSuccess(t('incident_added'));
			await load();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function resolveIncident(id: string) {
		try {
			await gqlMutate(UPDATE_INCIDENT, {
				input: {id, markResolved: true},
			});
			toastSuccess(t('incident_resolved'));
			await load();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function removeIncident(id: string) {
		if (!window.confirm(t('incident_delete_confirm'))) return;
		try {
			await gqlMutate(DELETE_INCIDENT, {id});
			toastSuccess(t('incident_deleted'));
			await load();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	if (loading) return <div className={b('empty')}>{t('loading')}</div>;

	const isSubmitted = !!report?.submitted_at;

	return (
		<div className={b('delegate-report-tab')}>
			{/* Submission banner */}
			{isSubmitted && (
				<div className={b('info-banner')} style={{marginBottom: '1rem'}}>
					<Check weight="bold" />
					<span>
						{t('report_submitted_by', {
							name: report?.submitted_by?.username || '?',
							at: new Date(report.submitted_at).toLocaleString(),
						})}
					</span>
				</div>
			)}

			{/* Report form */}
			<div className={b('section-title')}>{t('delegate_report_sections')}</div>

			<div className={b('field')}>
				<label className={b('label')}>{t('report_summary')}</label>
				<textarea
					className={b('textarea')}
					rows={4}
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
				/>
			</div>
			<div className={b('field')}>
				<label className={b('label')}>{t('report_venue_notes')}</label>
				<textarea
					className={b('textarea')}
					rows={3}
					value={venueNotes}
					onChange={(e) => setVenueNotes(e.target.value)}
				/>
			</div>
			<div className={b('field')}>
				<label className={b('label')}>{t('report_org_notes')}</label>
				<textarea
					className={b('textarea')}
					rows={3}
					value={orgNotes}
					onChange={(e) => setOrgNotes(e.target.value)}
				/>
			</div>
			<div className={b('field')}>
				<label className={b('label')}>{t('report_incidents_summary')}</label>
				<textarea
					className={b('textarea')}
					rows={3}
					value={incidentsSummary}
					onChange={(e) => setIncidentsSummary(e.target.value)}
				/>
			</div>
			<div className={b('field')}>
				<label className={b('label')}>{t('report_remarks')}</label>
				<textarea
					className={b('textarea')}
					rows={3}
					value={remarks}
					onChange={(e) => setRemarks(e.target.value)}
				/>
			</div>

			<div style={{display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap'}}>
				<button
					type="button"
					className={b('status-btn')}
					onClick={saveReport}
					disabled={saving}
				>
					<Pencil weight="bold" /> {t('save')}
				</button>
				<button
					type="button"
					className={b('status-btn', {primary: true})}
					onClick={submitReport}
					disabled={saving || isSubmitted}
				>
					<Check weight="bold" /> {isSubmitted ? t('already_submitted') : t('submit_report')}
				</button>
			</div>

			{/* Incidents list */}
			<div className={b('section-title')} style={{marginTop: '2rem'}}>
				{t('incidents')}
			</div>
			<div style={{marginBottom: '0.75rem'}}>
				<button
					type="button"
					className={b('status-btn')}
					onClick={addIncident}
				>
					<Plus weight="bold" /> {t('add_incident')}
				</button>
			</div>

			{incidents.length === 0 ? (
				<div className={b('empty')}>{t('no_incidents')}</div>
			) : (
				<div className={b('incident-list')}>
					{incidents.map((inc) => (
						<div
							key={inc.id}
							className={b('incident-row', {resolved: !!inc.resolved_at})}
						>
							<div style={{flex: 1}}>
								<strong>{inc.title}</strong>
								{inc.description && (
									<div style={{fontSize: 13, opacity: 0.8, marginTop: 4}}>
										{inc.description}
									</div>
								)}
								<div style={{fontSize: 12, opacity: 0.6, marginTop: 6}}>
									{inc.created_by?.username || '?'} —{' '}
									{new Date(inc.created_at).toLocaleString()}
									{inc.resolved_at && ` · ${t('resolved')}`}
								</div>
							</div>
							<div style={{display: 'flex', gap: '0.3rem'}}>
								{!inc.resolved_at && (
									<button
										type="button"
										className={b('action-btn', {approve: true})}
										onClick={() => resolveIncident(inc.id)}
										title={t('mark_resolved')}
									>
										<Check weight="bold" />
									</button>
								)}
								<button
									type="button"
									className={b('action-btn', {reject: true})}
									onClick={() => removeIncident(inc.id)}
									title={t('delete')}
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
