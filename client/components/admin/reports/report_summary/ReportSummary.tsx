import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import './ReportSummary.scss';
import {
	AdminSetAlgSetHiddenDocument,
	Report,
	ReportAlgSet,
	ReportSummary as ReportSummarySchema,
} from '../../../../@types/generated/graphql';
import block from '../../../../styles/bem';
import Avatar from '../../../common/avatar/Avatar';
import Tag from '../../../common/tag/Tag';
import {getDateFromNow} from '../../../../util/dates';
import Button from '../../../common/button/Button';
import {gql, useMutation} from '@apollo/client';
import {toastError} from '../../../../util/toast';
import {getGqlErrorMessage} from '../../../../util/gql-error';
import {algSetHiddenSource, parseAlgSetReportReason} from './alg_set_report';

const b = block('admin-report-summary');

const RESOLVE_REPORTS_MUTATION = gql`
	mutation Mutate($userId: String) {
		resolveReports(userId: $userId)
	}
`;

interface Props {
	reportSummary: ReportSummarySchema;
	/** Called after a set was hidden or shown, so the list can refetch (showing resolves that set's reports). */
	onChanged?: () => void;
}

export default function ReportSummary(props: Props) {
	const {t} = useTranslation();
	const {reportSummary, onChanged} = props;
	// Hidden state the admin just set, keyed by set id, so every row of the same set agrees before the refetch lands.
	const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean>>({});

	const [resolveReports, resolveReportsData] = useMutation<
		{resolveReports: number},
		{
			userId: string;
		}
	>(RESOLVE_REPORTS_MUTATION);

	function onAlgSetHiddenChanged(setId: string, hidden: boolean) {
		setHiddenOverrides((prev) => ({...prev, [setId]: hidden}));
		onChanged?.();
	}

	const rows = reportSummary.reports.map((report: Report) => (
		<SingleReport
			key={report.id}
			report={report}
			hiddenOverride={report.alg_set?.id ? hiddenOverrides[report.alg_set.id] : undefined}
			onAlgSetHiddenChanged={onAlgSetHiddenChanged}
		/>
	));
	const count = reportSummary.count;
	const topInfo = (
		<div className={b('top-info')}>
			<Tag backgroundColor="orange" text={`${count} report${count === 1 ? '' : 's'}`} />
			<Tag small text={t('report.last_report', { date: getDateFromNow(reportSummary.last_report) })} />
			<Tag small text={t('report.first_report', { date: getDateFromNow(reportSummary.first_report) })} />
		</div>
	);

	function markAsResolved() {
		resolveReports({
			variables: {
				userId: reportSummary.user.id,
			},
		});
	}

	if (resolveReportsData?.data?.resolveReports) {
		return null;
	}

	return (
		<div className={b()}>
			<div className={b('body')}>
				{topInfo}
				<div className={b('user')}>
					<Avatar showOptions user={reportSummary.user} />
				</div>
				<div className={b('rows')}>{rows}</div>
				<div className={b('actions')}>
					<Button
						text={t('report.mark_as_resolved')}
						loading={resolveReportsData?.loading}
						onClick={markAsResolved}
						primary
						glow
					/>
				</div>
			</div>
		</div>
	);
}

interface SingleReportProps {
	report: Report;
	hiddenOverride?: boolean;
	onAlgSetHiddenChanged: (setId: string, hidden: boolean) => void;
}

function SingleReport(props: SingleReportProps) {
	const {t} = useTranslation();
	const {report, hiddenOverride, onAlgSetHiddenChanged} = props;

	const byUsername = report.created_by.username;
	const algSetReport = parseAlgSetReportReason(report.reason);

	let reasonText: string = report.reason;
	if (algSetReport) {
		reasonText = algSetReport.reason
			? t(`admin_reports.alg_set_reason_${algSetReport.reason}`)
			: algSetReport.rawReason;
	}

	return (
		<div className={b('report')}>
			<p className={b('reason')}>{reasonText}</p>
			{algSetReport?.note ? <p className={b('note')}>{algSetReport.note}</p> : null}
			{algSetReport ? (
				<AlgSetLine
					algSet={report.alg_set}
					hiddenOverride={hiddenOverride}
					onHiddenChanged={onAlgSetHiddenChanged}
				/>
			) : null}
			<a href={`/user/${byUsername}`} target="_blank" className={b('reporter')}>
				{byUsername}
			</a>
		</div>
	);
}

interface AlgSetLineProps {
	/** Null when the set was deleted after the report (Report.alg_set_id is SetNull). */
	algSet?: ReportAlgSet | null;
	hiddenOverride?: boolean;
	onHiddenChanged: (setId: string, hidden: boolean) => void;
}

function AlgSetLine(props: AlgSetLineProps) {
	const {t} = useTranslation();
	const {algSet, hiddenOverride, onHiddenChanged} = props;

	const [setHidden, setHiddenData] = useMutation(AdminSetAlgSetHiddenDocument);

	if (!algSet?.id) {
		return (
			<div className={b('alg-set')}>
				<Tag small text={t('admin_reports.alg_set_deleted')} />
			</div>
		);
	}

	const hidden = hiddenOverride ?? !!algSet.hidden;
	const hiddenSource = algSetHiddenSource(algSet.hidden_reason);
	let hiddenText = '';
	if (hidden) {
		if (hiddenOverride === true || hiddenSource === 'admin') hiddenText = t('admin_reports.alg_set_hidden_admin');
		else if (hiddenSource === 'auto') hiddenText = t('admin_reports.alg_set_hidden_auto');
		else hiddenText = t('admin_reports.alg_set_hidden_reason', {reason: algSet.hidden_reason});
	}

	const visibility = algSet.visibility;
	const visibilityText =
		visibility === 'private' || visibility === 'link' || visibility === 'public'
			? t(`admin_reports.alg_set_visibility_${visibility}`)
			: visibility;

	async function toggleHidden() {
		const next = !hidden;
		try {
			await setHidden({variables: {set_id: algSet.id, hidden: next}});
			onHiddenChanged(algSet.id, next);
		} catch (e) {
			toastError(getGqlErrorMessage(e, t, 'admin_reports.alg_set_toggle_error'));
		}
	}

	return (
		<div className={b('alg-set')}>
			<div className={b('alg-set-info')}>
				<span className={b('alg-set-label')}>{t('admin_reports.alg_set_label')}</span>
				<a href={`/trainer/sets/${algSet.code}`} target="_blank" rel="noopener noreferrer" className={b('alg-set-link')}>
					{algSet.name}
				</a>
				{visibilityText ? <Tag small text={visibilityText} /> : null}
				{hidden ? <Tag small backgroundColor="red" text={hiddenText} /> : null}
			</div>
			{hidden ? <p className={b('alg-set-hint')}>{t('admin_reports.alg_set_show_hint')}</p> : null}
			<Button
				small
				text={hidden ? t('admin_reports.alg_set_show') : t('admin_reports.alg_set_hide')}
				danger={!hidden}
				loading={setHiddenData.loading}
				onClick={toggleHidden}
			/>
		</div>
	);
}
