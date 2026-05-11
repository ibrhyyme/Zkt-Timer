import React, {useState, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './Reports.scss';
import block from '../../../styles/bem';
import {gql, useQuery} from '@apollo/client';
import {REPORT_SUMMARY_FRAGMENT} from '../../../util/graphql/fragments';
import {ReportSummary as ReportSummarySchema} from '../../../@types/generated/graphql';
import Loading from '../../common/loading/Loading';
import Empty from '../../common/empty/Empty';
import ReportSummary from './report_summary/ReportSummary';
import HorizontalNav from '../../common/horizontal_nav/HorizontalNav';
import SupportTickets from './support_tickets/SupportTickets';

const b = block('admin-report-list');

const REPORTS_QUERY = gql`
	${REPORT_SUMMARY_FRAGMENT}

	query Query {
		reports {
			...ReportSummaryFragment
		}
	}
`;

type Tab = 'reports' | 'support';

export default function Reports() {
	const {t} = useTranslation();

	// URL query param ile baslangic tabini sec (notification linki support'a yonlendirebilir)
	const initialTab: Tab = useMemo(() => {
		if (typeof window === 'undefined') return 'reports';
		const params = new URLSearchParams(window.location.search);
		return params.get('tab') === 'support' ? 'support' : 'reports';
	}, []);

	const [activeTab, setActiveTab] = useState<Tab>(initialTab);

	const TABS = [
		{id: 'reports', value: t('admin_reports.tab_reports')},
		{id: 'support', value: t('admin_reports.tab_support')},
	];

	return (
		<div className={b()}>
			<HorizontalNav tabs={TABS} tabId={activeTab} onChange={(id) => setActiveTab(id as Tab)} />
			{activeTab === 'reports' ? <ReportsList /> : <SupportTickets />}
		</div>
	);
}

function ReportsList() {
	const {data, loading} = useQuery<{reports: ReportSummarySchema[]}>(REPORTS_QUERY, {
		fetchPolicy: 'no-cache',
	});

	if (loading) {
		return (
			<div className={b({loading})}>
				<Loading />
			</div>
		);
	} else if (!data?.reports || !data?.reports?.length) {
		return (
			<div className={b({empty: true})}>
				<Empty text="No reports to review" />
			</div>
		);
	}

	const reports = data.reports.map((report) => <ReportSummary reportSummary={report} key={report.last_report} />);

	return <div>{reports}</div>;
}
