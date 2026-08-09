// Moderation queue for reported conversations.
//
// The important property of this screen is what it cannot do: there is no way to open a
// thread, page backwards, or look up a user's inbox. Every message shown here was
// attached by the reporter at the moment they filed the report, and that is the only
// message text staff can reach anywhere in the product. Keep it that way.

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {CheckCircle, XCircle} from 'phosphor-react';
import {gqlMutateTyped, gqlQueryTyped} from '../../../api';
import {
	MessageReportsDocument,
	MessageReportsQuery,
	ResolveMessageReportDocument,
	ReportStatus,
} from '../../../../@types/generated/graphql';
import AvatarImage from '../../../common/avatar/avatar_image/AvatarImage';
import Loading from '../../../common/loading/Loading';
import Empty from '../../../common/empty/Empty';
import Button from '../../../common/button/Button';
import {getFullFormattedDate} from '../../../../util/dates';
import {toastError} from '../../../../util/toast';
import block from '../../../../styles/bem';
import './MessageReports.scss';

const b = block('admin-message-reports');

type Report = MessageReportsQuery['messageReports']['reports'][number];

export default function MessageReports() {
	const {t} = useTranslation();
	const [reports, setReports] = useState<Report[]>([]);
	const [openCount, setOpenCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [showResolved, setShowResolved] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);

	async function load(resolved: boolean) {
		setLoading(true);
		try {
			const res = await gqlQueryTyped(
				MessageReportsDocument,
				{status: resolved ? null : ReportStatus.Open},
				{fetchPolicy: 'no-cache'}
			);
			const data = res?.data?.messageReports;
			setReports((data?.reports as Report[]) || []);
			setOpenCount(data?.open_count || 0);
		} catch (e) {
			toastError(e as Error);
		} finally {
			setLoading(false);
		}
	}

	React.useEffect(() => {
		void load(showResolved);
	}, [showResolved]);

	async function resolve(report: Report, action: ReportStatus) {
		setBusyId(report.id);
		try {
			await gqlMutateTyped(ResolveMessageReportDocument, {reportId: report.id, action});
			await load(showResolved);
		} catch (e) {
			toastError(e as Error);
		} finally {
			setBusyId(null);
		}
	}

	return (
		<div className={b()}>
			<div className={b('head')}>
				<span className={b('count')}>{t('admin_message_reports.open_count', {count: openCount})}</span>
				<button type="button" className={b('toggle')} onClick={() => setShowResolved(!showResolved)}>
					{showResolved ? t('admin_message_reports.show_open') : t('admin_message_reports.show_all')}
				</button>
			</div>

			<p className={b('scope')}>{t('admin_message_reports.scope_note')}</p>

			{loading && <Loading />}
			{!loading && reports.length === 0 && <Empty text={t('admin_message_reports.empty')} />}

			{!loading &&
				reports.map((report) => (
					<div key={report.id} className={b('card')}>
						<div className={b('card-head')}>
							<div className={b('party')}>
								<span className={b('party-label')}>{t('admin_message_reports.reported')}</span>
								<AvatarImage small user={report.reported as any} profile={(report.reported as any)?.profile} />
								<span className={b('party-name')}>{report.reported?.username}</span>
							</div>
							<div className={b('party')}>
								<span className={b('party-label')}>{t('admin_message_reports.reporter')}</span>
								<AvatarImage small user={report.reporter as any} profile={(report.reporter as any)?.profile} />
								<span className={b('party-name')}>{report.reporter?.username}</span>
							</div>
							<span className={b('date')}>{getFullFormattedDate(report.created_at)}</span>
						</div>

						<div className={b('reason')}>
							<span className={b('reason-label')}>{t('admin_message_reports.reason')}</span>
							{report.reason}
						</div>

						<div className={b('snapshot')}>
							{report.snapshot.length === 0 && (
								<p className={b('snapshot-empty')}>{t('admin_message_reports.no_snapshot')}</p>
							)}
							{report.snapshot.map((m) => (
								<div
									key={m.id}
									className={b('snapshot-row', {reported: m.sender_id === report.reported?.id})}
								>
									<span className={b('snapshot-sender')}>{m.sender_username || m.sender_id}</span>
									<span className={b('snapshot-body')}>
										{m.body || (m.has_solve ? t('admin_message_reports.solve_only') : '')}
									</span>
								</div>
							))}
						</div>

						{report.status === ReportStatus.Open ? (
							<div className={b('actions')}>
								<Button
									gray
									small
									disabled={busyId === report.id}
									icon={<XCircle weight="bold" />}
									text={t('admin_message_reports.dismiss')}
									onClick={() => void resolve(report, ReportStatus.Dismissed)}
								/>
								<Button
									primary
									small
									disabled={busyId === report.id}
									icon={<CheckCircle weight="bold" />}
									text={t('admin_message_reports.actioned')}
									onClick={() => void resolve(report, ReportStatus.Actioned)}
								/>
							</div>
						) : (
							<div className={b('resolved')}>
								{t('admin_message_reports.resolved_by', {
									status: report.status,
									name: report.reviewed_by?.username || '',
								})}
							</div>
						)}
					</div>
				))}
		</div>
	);
}
