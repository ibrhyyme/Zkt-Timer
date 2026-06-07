import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b, getEventName, formatCs, competitorDisplayName} from '../shared';
import {generateCertificatesPdf} from '../../../../util/cubes/certificate_pdf';

const UPDATE_STATUS = gql`
	mutation UpdateZktCompStatus($input: UpdateZktCompetitionStatusInput!) {
		updateZktCompetitionStatus(input: $input) {
			id
			status
		}
	}
`;

const CONFIRM = gql`
	mutation ConfirmZktComp($id: String!) {
		confirmZktCompetition(id: $id) {
			id
			status
			confirmed_at
		}
	}
`;

const ANNOUNCE = gql`
	mutation AnnounceZktComp($id: String!) {
		announceZktCompetition(id: $id) {
			id
			status
			announced_at
		}
	}
`;

const CANCEL = gql`
	mutation CancelZktComp($input: CancelZktCompetitionInput!) {
		cancelZktCompetition(input: $input) {
			id
			status
			cancelled_at
			cancel_reason
		}
	}
`;

const PUBLISH = gql`
	mutation PublishZktResults($id: String!) {
		publishZktResults(id: $id) {
			id
			status
			results_published_at
		}
	}
`;

const UNPUBLISH = gql`
	mutation UnpublishZktResults($id: String!) {
		unpublishZktResults(id: $id) {
			id
			status
			results_published_at
		}
	}
`;

const EXPORT_WCIF = gql`
	query ExportZktWcif($id: String!) {
		exportZktCompetitionWcif(id: $id)
	}
`;

const PODIUMS_FOR_CERT = gql`
	query ZktPodiumsForCert($id: String!) {
		zktCompetitionPodiums(id: $id) {
			event_id
			results {
				ranking
				best
				average
				user {
					username
					first_name
					last_name
				}
			}
		}
	}
`;

// Forward-path transitions that use the plain updateZktCompetitionStatus mutation.
// Dedicated mutations handle: confirm, announce, cancel, publish, unpublish.
const STATUS_FLOW: Record<string, string[]> = {
	CONFIRMED: ['DRAFT'],
	ANNOUNCED: ['REGISTRATION_OPEN', 'CONFIRMED'],
	REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'ANNOUNCED'],
	REGISTRATION_CLOSED: ['ONGOING', 'REGISTRATION_OPEN'],
	ONGOING: ['FINISHED'],
	FINISHED: ['ONGOING'],
};

// States from which cancellation is allowed.
const CANCELLABLE = new Set([
	'DRAFT',
	'CONFIRMED',
	'ANNOUNCED',
	'REGISTRATION_OPEN',
	'REGISTRATION_CLOSED',
	'ONGOING',
]);

export default function DashboardOverview({detail, onUpdated}: {detail: any; onUpdated: () => void}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [working, setWorking] = useState(false);

	const approvedCount = detail.registrations.filter((r: any) => r.status === 'APPROVED').length;
	const pendingCount = detail.registrations.filter((r: any) => r.status === 'PENDING').length;
	const nextStatuses = STATUS_FLOW[detail.status] || [];

	async function run(fn: () => Promise<any>, successKey: string) {
		if (working) return;
		setWorking(true);
		try {
			await fn();
			toastSuccess(t(successKey));
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setWorking(false);
		}
	}

	async function changeStatus(newStatus: string) {
		return run(
			() =>
				gqlMutate(UPDATE_STATUS, {
					input: {competitionId: detail.id, status: newStatus},
				}),
			'status_updated'
		);
	}

	async function onConfirm() {
		return run(() => gqlMutate(CONFIRM, {id: detail.id}), 'status_confirmed_ok');
	}

	async function onAnnounce() {
		if (!window.confirm(t('announce_confirm_prompt'))) return;
		return run(() => gqlMutate(ANNOUNCE, {id: detail.id}), 'status_announced_ok');
	}

	async function onCancel() {
		const reason = window.prompt(t('cancel_reason_prompt'));
		if (reason === null) return; // user dismissed
		return run(
			() =>
				gqlMutate(CANCEL, {
					input: {competitionId: detail.id, reason: reason.trim() || null},
				}),
			'status_cancelled_ok'
		);
	}

	async function onPublish() {
		if (!window.confirm(t('publish_results_confirm'))) return;
		return run(() => gqlMutate(PUBLISH, {id: detail.id}), 'results_published_ok');
	}

	async function onUnpublish() {
		if (!window.confirm(t('unpublish_results_confirm'))) return;
		return run(() => gqlMutate(UNPUBLISH, {id: detail.id}), 'results_unpublished_ok');
	}

	async function onExportWcif() {
		if (working) return;
		setWorking(true);
		try {
			const res: any = await gqlMutate(EXPORT_WCIF, {id: detail.id});
			const json: string = res?.data?.exportZktCompetitionWcif;
			if (!json) throw new Error('Empty WCIF');
			const blob = new Blob([json], {type: 'application/json;charset=utf-8'});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${detail.name.replace(/\s+/g, '_')}.wcif.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toastSuccess(t('wcif_exported'));
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setWorking(false);
		}
	}

	// Podium certificates: top-3 of each event's final round → one A4 landscape
	// certificate per page. i18n strings are built here; the generator is pure.
	async function onDownloadCertificates() {
		if (working) return;
		setWorking(true);
		try {
			const res: any = await gqlMutate(PODIUMS_FOR_CERT, {id: detail.id});
			const podiums: any[] = res?.data?.zktCompetitionPodiums || [];
			const certs: {name: string; place: number; lines: string[]}[] = [];
			for (const p of podiums) {
				const eventName = getEventName(p.event_id);
				for (const r of p.results || []) {
					if (r.ranking == null || r.ranking > 3) continue;
					const name = competitorDisplayName(r.user) || r.user?.username || '';
					const resultLine =
						r.average && r.average > 0
							? `${t('average')}: ${formatCs(r.average)}`
							: `${t('best')}: ${formatCs(r.best)}`;
					certs.push({
						name,
						place: r.ranking,
						lines: [`${r.ranking}. — ${eventName}`, resultLine],
					});
				}
			}
			if (certs.length === 0) {
				toastError(t('no_podiums_for_certificate'));
				return;
			}
			const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;
			const dateStr = new Date(detail.date_start).toLocaleDateString(locale);
			await generateCertificatesPdf({
				title: t('certificate_title'),
				competitionName: detail.name,
				subtitle: [dateStr, detail.location].filter(Boolean).join(' · '),
				signerLabel: t('certificate_signer'),
				signerName: detail.created_by?.username,
				footerNote: t('certificate_footer'),
				certificates: certs,
			});
			toastSuccess(t('certificates_downloaded'));
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setWorking(false);
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

			{detail.status === 'CANCELLED' && detail.cancel_reason && (
				<div className={b('cancelled-banner')}>
					<div className={b('section-title')}>{t('cancellation_reason')}</div>
					<div className={b('description-text')}>{detail.cancel_reason}</div>
				</div>
			)}

			<div className={b('status-section')}>
				<div className={b('section-title')}>{t('change_status')}</div>
				<div className={b('current-status')}>
					{t('current_status')}: <strong>{t(`status_${detail.status.toLowerCase()}`)}</strong>
				</div>

				{['DRAFT', 'CONFIRMED'].includes(detail.status) &&
					(() => {
						// Pre-confirmation checklist (WCA Organizer-view style). Soft
						// warnings only — ZKT is unofficial, nothing is enforced here.
						const warnings: string[] = [];
						const daysToStart = Math.ceil(
							(new Date(detail.date_start).getTime() - Date.now()) / (24 * 3600 * 1000)
						);
						if (daysToStart >= 0 && daysToStart < 28) {
							warnings.push(t('announce_28day_warning', {days: daysToStart}));
						}
						if (detail.events.length === 0) {
							warnings.push(t('warning_no_events'));
						}
						for (const ev of detail.events) {
							if (ev.rounds.length === 0) {
								warnings.push(t('warning_no_rounds', {event: getEventName(ev.event_id)}));
								continue;
							}
							// Every non-final round needs an advancement condition.
							const nonFinal = ev.rounds.slice(0, -1);
							if (nonFinal.some((r: any) => !r.advancement_type)) {
								warnings.push(
									t('warning_no_advancement', {event: getEventName(ev.event_id)})
								);
							}
						}
						return warnings.map((w, i) => (
							<div key={i} className={b('announce-warning')}>
								{w}
							</div>
						));
					})()}

				<div className={b('status-actions')}>
					{detail.status === 'DRAFT' && (
						<button
							className={b('status-btn', {confirmed: true})}
							onClick={onConfirm}
							disabled={working}
						>
							{t('transition_to_confirmed')}
						</button>
					)}

					{detail.status === 'CONFIRMED' && (
						<button
							className={b('status-btn', {announced: true})}
							onClick={onAnnounce}
							disabled={working}
						>
							{t('transition_to_announced')}
						</button>
					)}

					{detail.status === 'FINISHED' && (
						<button
							className={b('status-btn', {published: true})}
							onClick={onPublish}
							disabled={working}
						>
							{t('transition_to_published')}
						</button>
					)}

					{detail.status === 'PUBLISHED' && (
						<button
							className={b('status-btn', {finished: true})}
							onClick={onUnpublish}
							disabled={working}
						>
							{t('transition_to_unpublish')}
						</button>
					)}

					{nextStatuses.map((s) => (
						<button
							key={s}
							className={b('status-btn', {[s.toLowerCase()]: true})}
							onClick={() => changeStatus(s)}
							disabled={working}
						>
							{t(`transition_to_${s.toLowerCase()}`)}
						</button>
					))}

					{CANCELLABLE.has(detail.status) && (
						<button
							className={b('status-btn', {cancelled: true})}
							onClick={onCancel}
							disabled={working}
						>
							{t('transition_to_cancelled')}
						</button>
					)}
				</div>

				{detail.status === 'CANCELLED' && (
					<div className={b('status-final')}>{t('status_final')}</div>
				)}
			</div>

			<div className={b('export-section')}>
				<div className={b('section-title')}>{t('export_title')}</div>
				<button
					type="button"
					className={b('status-btn')}
					onClick={onExportWcif}
					disabled={working}
				>
					{t('export_wcif')}
				</button>
				<button
					type="button"
					className={b('status-btn')}
					onClick={onDownloadCertificates}
					disabled={working}
					style={{marginLeft: '0.5rem'}}
				>
					{t('download_certificates')}
				</button>
				<p style={{fontSize: 13, opacity: 0.7, marginTop: '0.5rem'}}>
					{t('export_wcif_hint')}
				</p>
			</div>
		</div>
	);
}
