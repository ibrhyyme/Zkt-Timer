import React from 'react';
import {gql} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import SelectMenu from '../../common/select_menu/SelectMenu';
import {gqlQuery} from '../../api';
import {
	GrowthBucketData,
	ReportRow,
	YearMonth,
	buildDayRows,
	buildMatrix,
	buildMonthAcrossYears,
	buildYearRows,
	peakRow,
	percentChange,
	previousMonthCount,
	reportYears,
	sumRows,
} from './growth_report';

export type GrowthMetric = 'signups' | 'solves';

const GROWTH_REPORT_QUERY = gql`
	query AdminGrowthReport($metric: String!, $year: Int, $month: Int, $includeMonths: Boolean) {
		adminGrowthReport(metric: $metric, year: $year, month: $month, includeMonths: $includeMonths) {
			metric
			months {
				key
				count
				activated
				pro
			}
			days {
				key
				count
				activated
				pro
			}
			countries {
				country
				count
			}
			scope_total
		}
	}
`;

interface GrowthCountryData {
	country: string;
	count: number;
}

interface GrowthReportData {
	metric: string;
	months: GrowthBucketData[];
	days: GrowthBucketData[];
	countries: GrowthCountryData[];
	scope_total: number;
}

interface Detail {
	days: GrowthBucketData[];
	countries: GrowthCountryData[];
	scopeTotal: number;
}

const EMPTY_DETAIL: Detail = {days: [], countries: [], scopeTotal: 0};
const ALL = 'all';

function istanbulToday(): YearMonth & {day: number} {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Istanbul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(new Date());
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
	return {year: get('year'), month: get('month'), day: get('day')};
}

function useFormatters(locale: string) {
	return React.useMemo(() => {
		const num = new Intl.NumberFormat(locale);
		const dec = new Intl.NumberFormat(locale, {maximumFractionDigits: 1});
		const pct = new Intl.NumberFormat(locale, {style: 'percent', maximumFractionDigits: 0});
		const monthLong = new Intl.DateTimeFormat(locale, {month: 'long', timeZone: 'UTC'});
		const monthShort = new Intl.DateTimeFormat(locale, {month: 'short', timeZone: 'UTC'});
		const monthYear = new Intl.DateTimeFormat(locale, {month: 'long', year: 'numeric', timeZone: 'UTC'});
		const dayLabel = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', timeZone: 'UTC'});
		const weekday = new Intl.DateTimeFormat(locale, {weekday: 'short', timeZone: 'UTC'});
		let regions: Intl.DisplayNames | null = null;
		try {
			regions = new Intl.DisplayNames([locale], {type: 'region'});
		} catch {
			regions = null;
		}
		const utc = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d));
		return {
			num: (n: number) => num.format(n),
			dec: (n: number) => dec.format(n),
			pct: (part: number, whole: number) => (whole > 0 ? pct.format(part / whole) : '-'),
			monthLong: (m: number) => monthLong.format(utc(2000, m)),
			monthShort: (m: number) => monthShort.format(utc(2000, m)),
			monthYear: (y: number, m: number) => monthYear.format(utc(y, m)),
			day: (y: number, m: number, d: number) => dayLabel.format(utc(y, m, d)),
			weekday: (y: number, m: number, d: number) => weekday.format(utc(y, m, d)),
			region: (code: string) => {
				if (!/^[A-Z]{2}$/.test(code)) return null;
				try {
					return regions?.of(code) || code;
				} catch {
					return code;
				}
			},
		};
	}, [locale]);
}

type Formatters = ReturnType<typeof useFormatters>;

function Change({value}: {value: number | null}) {
	if (value === null) return <span className="zt-admin-dashboard__report-muted">-</span>;
	const sign = value > 0 ? '+' : '';
	const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
	return <span className={`zt-admin-dashboard__report-change zt-admin-dashboard__report-change--${tone}`}>{`${sign}${value}%`}</span>;
}

function CountBar({count, max, label}: {count: number; max: number; label: string}) {
	const width = max > 0 ? Math.max(count > 0 ? 2 : 0, Math.round((count / max) * 100)) : 0;
	return (
		<span className="zt-admin-dashboard__report-count">
			<span className="zt-admin-dashboard__report-bar" aria-hidden="true">
				<span className="zt-admin-dashboard__report-bar-fill" style={{width: `${width}%`}} />
			</span>
			<span className="zt-admin-dashboard__report-num">{label}</span>
		</span>
	);
}

interface Props {
	metric: GrowthMetric;
	initialYear?: number | null;
	initialMonth?: number | null;
}

export default function GrowthReportPanel({metric, initialYear = null, initialMonth = null}: Props) {
	const {t, i18n} = useTranslation();
	const f = useFormatters(i18n.language);
	const today = React.useMemo(() => istanbulToday(), []);
	const now: YearMonth = {year: today.year, month: today.month};

	const [year, setYear] = React.useState<number | null>(initialYear);
	const [month, setMonth] = React.useState<number | null>(initialMonth);
	const [months, setMonths] = React.useState<GrowthBucketData[] | null>(null);
	const [detail, setDetail] = React.useState<Detail>(EMPTY_DETAIL);
	const [loading, setLoading] = React.useState(true);
	const [failed, setFailed] = React.useState(false);
	const monthsLoaded = months !== null;

	React.useEffect(() => {
		let cancelled = false;
		const needsDetail = metric === 'signups' || (year !== null && month !== null);

		// The all-time month series is fetched once; a new selection only asks for the
		// days and countries it changes. Solves have no countries, so outside a single
		// month there is nothing more to fetch.
		if (monthsLoaded && !needsDetail) {
			setDetail(EMPTY_DETAIL);
			setLoading(false);
			return;
		}

		setLoading(true);
		setFailed(false);
		gqlQuery<{adminGrowthReport: GrowthReportData}>(
			GROWTH_REPORT_QUERY,
			{metric, year, month, includeMonths: !monthsLoaded},
			'no-cache',
		)
			.then((res) => {
				if (cancelled) return;
				const data = res.data.adminGrowthReport;
				if (!monthsLoaded) setMonths(data.months || []);
				setDetail({days: data.days || [], countries: data.countries || [], scopeTotal: data.scope_total || 0});
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
		// monthsLoaded flips once, after the first answer; it must not refetch then.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [metric, year, month]);

	const cohort = metric === 'signups';
	const years = React.useMemo(() => reportYears(months || [], now), [months, now.year, now.month]);

	const yearOptions = [
		{value: ALL, label: t('admin_dashboard.report_all_years')},
		...years.map((y) => ({value: String(y), label: String(y)})),
	];
	const monthOptions = [
		{value: ALL, label: t('admin_dashboard.report_all_months')},
		...Array.from({length: 12}, (_, i) => ({value: String(i + 1), label: f.monthLong(i + 1)})),
	];

	const title = t(metric === 'signups' ? 'admin_dashboard.report_signups_title' : 'admin_dashboard.report_solves_title');
	const countLabel = t(metric === 'signups' ? 'admin_dashboard.report_col_signups' : 'admin_dashboard.report_col_solves');

	let body: React.ReactNode = null;
	if (failed) {
		body = <div className="zt-admin-dashboard__table-empty">{t('admin_dashboard.report_failed')}</div>;
	} else if (!months || (loading && !monthsLoaded)) {
		body = <div className="zt-admin-dashboard__table-loading">{t('admin_dashboard.loading')}</div>;
	} else if (year === null && month === null) {
		body = <MatrixView months={months} now={now} f={f} metric={metric} />;
	} else {
		body = (
			<ListView
				metric={metric}
				months={months}
				detail={detail}
				detailLoading={loading}
				year={year}
				month={month}
				today={today}
				now={now}
				f={f}
				countLabel={countLabel}
				cohort={cohort}
			/>
		);
	}

	return (
		<div className="zt-admin-dashboard__expand-panel zt-admin-dashboard__report">
			<div className="zt-admin-dashboard__report-head">
				<h3 className="zt-admin-dashboard__report-title">{title}</h3>
				<div className="zt-admin-dashboard__report-controls">
					<div className="zt-admin-dashboard__report-field">
						<span className="zt-admin-dashboard__report-field-label">{t('admin_dashboard.report_year')}</span>
						<SelectMenu
							value={year === null ? ALL : String(year)}
							onChange={(v) => setYear(v === ALL ? null : Number(v))}
							options={yearOptions}
							ariaLabel={t('admin_dashboard.report_year')}
						/>
					</div>
					<div className="zt-admin-dashboard__report-field">
						<span className="zt-admin-dashboard__report-field-label">{t('admin_dashboard.report_month')}</span>
						<SelectMenu
							value={month === null ? ALL : String(month)}
							onChange={(v) => setMonth(v === ALL ? null : Number(v))}
							options={monthOptions}
							ariaLabel={t('admin_dashboard.report_month')}
						/>
					</div>
				</div>
			</div>
			{body}
		</div>
	);
}

function MatrixView({months, now, f, metric}: {months: GrowthBucketData[]; now: YearMonth; f: Formatters; metric: GrowthMetric}) {
	const {t} = useTranslation();
	const rows = buildMatrix(months, now);
	if (rows.every((r) => r.total === 0)) {
		return <div className="zt-admin-dashboard__table-empty">{t('admin_dashboard.report_empty')}</div>;
	}

	const total = rows.reduce((s, r) => s + r.total, 0);
	let peakCell: {year: number; month: number; count: number} | null = null;
	for (const r of rows) {
		for (let i = 0; i < r.cells.length; i++) {
			const c = r.cells[i];
			if (c !== null && c > 0 && (!peakCell || c > peakCell.count)) peakCell = {year: r.year, month: i + 1, count: c};
		}
	}
	const totalKey = metric === 'signups' ? 'admin_dashboard.report_summary_signups' : 'admin_dashboard.report_summary_solves';

	return (
		<>
			<div className="zt-admin-dashboard__panel-summary">
				{t(totalKey, {period: t('admin_dashboard.report_period_all'), n: f.num(total)})}
				{peakCell && (
					<span className="zt-admin-dashboard__panel-summary-note">
						{t('admin_dashboard.report_summary_peak', {
							label: f.monthYear(peakCell.year, peakCell.month),
							n: f.num(peakCell.count),
						})}
					</span>
				)}
			</div>
			<div className="zt-admin-dashboard__report-scroll">
				<table className="zt-admin-dashboard__report-table zt-admin-dashboard__report-table--matrix">
					<thead>
						<tr>
							<th>{t('admin_dashboard.report_col_year')}</th>
							{Array.from({length: 12}, (_, i) => (
								<th key={i} className="zt-admin-dashboard__report-cell--num">
									{f.monthShort(i + 1)}
								</th>
							))}
							<th className="zt-admin-dashboard__report-cell--num">{t('admin_dashboard.report_total')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.year}>
								<th scope="row">{r.year}</th>
								{r.cells.map((c, i) => {
									const isPeak = !!peakCell && peakCell.year === r.year && peakCell.month === i + 1;
									return (
										<td
											key={i}
											className={`zt-admin-dashboard__report-cell--num${isPeak ? ' zt-admin-dashboard__report-cell--peak' : ''}`}
										>
											{c === null ? <span className="zt-admin-dashboard__report-muted">-</span> : f.num(c)}
										</td>
									);
								})}
								<td className="zt-admin-dashboard__report-cell--num zt-admin-dashboard__report-cell--total">{f.num(r.total)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

interface ListViewProps {
	metric: GrowthMetric;
	months: GrowthBucketData[];
	detail: Detail;
	detailLoading: boolean;
	year: number | null;
	month: number | null;
	today: YearMonth & {day: number};
	now: YearMonth;
	f: Formatters;
	countLabel: string;
	cohort: boolean;
}

function ListView(props: ListViewProps) {
	const {metric, months, detail, detailLoading, year, month, today, now, f, countLabel, cohort} = props;
	const {t} = useTranslation();

	const mode: 'year' | 'month_all_years' | 'days' =
		year !== null && month !== null ? 'days' : year !== null ? 'year' : 'month_all_years';

	if (mode === 'days' && detailLoading) {
		return <div className="zt-admin-dashboard__table-loading">{t('admin_dashboard.loading')}</div>;
	}

	let rows: ReportRow[] = [];
	if (mode === 'year') rows = buildYearRows(months, year as number, now, cohort);
	else if (mode === 'month_all_years') rows = buildMonthAcrossYears(months, month as number, now, cohort);
	else rows = buildDayRows(detail.days, year as number, month as number, today, cohort);

	if (rows.length === 0) {
		return <div className="zt-admin-dashboard__table-empty">{t('admin_dashboard.report_empty')}</div>;
	}

	const totals = sumRows(rows, cohort);
	const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
	const peak = peakRow(rows);
	const showPrevious = mode !== 'days';
	// Summing one month across years against the same sums a year earlier counts every
	// middle year twice, so that view compares row by row only.
	const showTotalChange = mode === 'year';
	const hasPartial = showPrevious && rows.some((r) => r.partial && r.previous !== null);

	const label = (r: ReportRow): string => {
		if (mode === 'year') return f.monthLong(r.month as number);
		if (mode === 'month_all_years') return String(r.year);
		return `${f.day(r.year, r.month as number, r.day as number)} ${f.weekday(r.year, r.month as number, r.day as number)}`;
	};

	let period: string;
	if (mode === 'year') period = String(year);
	else if (mode === 'month_all_years') period = t('admin_dashboard.report_period_month_all_years', {month: f.monthLong(month as number)});
	else period = f.monthYear(year as number, month as number);

	const totalKey = metric === 'signups' ? 'admin_dashboard.report_summary_signups' : 'admin_dashboard.report_summary_solves';
	const notes: string[] = [];
	if (peak) notes.push(t('admin_dashboard.report_summary_peak', {label: label(peak), n: f.num(peak.count)}));
	if (mode === 'days') {
		notes.push(t('admin_dashboard.report_summary_daily_avg', {value: f.dec(totals.count / rows.length)}));
		const prev = previousMonthCount(months, year as number, month as number);
		if (prev !== null) {
			const pm = month === 1 ? {y: (year as number) - 1, m: 12} : {y: year as number, m: (month as number) - 1};
			notes.push(t('admin_dashboard.report_summary_prev_month', {label: f.monthYear(pm.y, pm.m), n: f.num(prev)}));
		}
	} else if (showTotalChange && totals.change !== null) {
		const sign = totals.change > 0 ? '+' : '';
		notes.push(t('admin_dashboard.report_summary_change', {change: `${sign}${totals.change}%`}));
	}

	const colLabel =
		mode === 'year'
			? t('admin_dashboard.report_col_month')
			: mode === 'month_all_years'
				? t('admin_dashboard.report_col_year')
				: t('admin_dashboard.report_col_day');

	return (
		<>
			<div className="zt-admin-dashboard__panel-summary">
				{t(totalKey, {period, n: f.num(totals.count)})}
				{notes.length > 0 && <span className="zt-admin-dashboard__panel-summary-note">{notes.join(' · ')}</span>}
			</div>

			<div className="zt-admin-dashboard__report-scroll">
				<table className="zt-admin-dashboard__report-table">
					<thead>
						<tr>
							<th>{colLabel}</th>
							<th className="zt-admin-dashboard__report-cell--wide">{countLabel}</th>
							{showPrevious && <th className="zt-admin-dashboard__report-cell--num">{t('admin_dashboard.report_col_previous')}</th>}
							{showPrevious && <th className="zt-admin-dashboard__report-cell--num">{t('admin_dashboard.report_col_change')}</th>}
							{cohort && <th className="zt-admin-dashboard__report-cell--num">{t('admin_dashboard.report_col_activated')}</th>}
							{cohort && <th className="zt-admin-dashboard__report-cell--num">{t('admin_dashboard.report_col_pro')}</th>}
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.key}>
								<th scope="row">
									{label(r)}
									{r.partial && <span className="zt-admin-dashboard__report-tag">{t('admin_dashboard.report_in_progress')}</span>}
								</th>
								<td className="zt-admin-dashboard__report-cell--wide">
									<CountBar count={r.count} max={max} label={f.num(r.count)} />
								</td>
								{showPrevious && (
									<td className="zt-admin-dashboard__report-cell--num">
										{r.previous === null ? <span className="zt-admin-dashboard__report-muted">-</span> : f.num(r.previous)}
									</td>
								)}
								{showPrevious && (
									<td className="zt-admin-dashboard__report-cell--num">
										<Change value={r.partial ? null : percentChange(r.count, r.previous)} />
									</td>
								)}
								{cohort && (
									<td className="zt-admin-dashboard__report-cell--num">
										{f.num(r.activated ?? 0)}
										<span className="zt-admin-dashboard__report-share">{f.pct(r.activated ?? 0, r.count)}</span>
									</td>
								)}
								{cohort && (
									<td className="zt-admin-dashboard__report-cell--num">
										{f.num(r.pro ?? 0)}
										<span className="zt-admin-dashboard__report-share">{f.pct(r.pro ?? 0, r.count)}</span>
									</td>
								)}
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<th scope="row">{t('admin_dashboard.report_total')}</th>
							<td className="zt-admin-dashboard__report-cell--wide">
								<span className="zt-admin-dashboard__report-num">{f.num(totals.count)}</span>
							</td>
							{showPrevious && (
								<td className="zt-admin-dashboard__report-cell--num">
									{!showTotalChange || totals.previous === null ? (
										<span className="zt-admin-dashboard__report-muted">-</span>
									) : (
										f.num(totals.previous)
									)}
								</td>
							)}
							{showPrevious && (
								<td className="zt-admin-dashboard__report-cell--num">
									<Change value={showTotalChange ? totals.change : null} />
								</td>
							)}
							{cohort && (
								<td className="zt-admin-dashboard__report-cell--num">
									{f.num(totals.activated ?? 0)}
									<span className="zt-admin-dashboard__report-share">{f.pct(totals.activated ?? 0, totals.count)}</span>
								</td>
							)}
							{cohort && (
								<td className="zt-admin-dashboard__report-cell--num">
									{f.num(totals.pro ?? 0)}
									<span className="zt-admin-dashboard__report-share">{f.pct(totals.pro ?? 0, totals.count)}</span>
								</td>
							)}
						</tr>
					</tfoot>
				</table>
			</div>

			{(hasPartial || cohort) && (
				<div className="zt-admin-dashboard__report-notes">
					{hasPartial && <p>{t('admin_dashboard.report_partial_note')}</p>}
					{cohort && <p>{t('admin_dashboard.report_cohort_note')}</p>}
				</div>
			)}

			{metric === 'signups' && <CountryList detail={detail} loading={detailLoading} f={f} />}
		</>
	);
}

function CountryList({detail, loading, f}: {detail: Detail; loading: boolean; f: Formatters}) {
	const {t} = useTranslation();
	if (loading || detail.countries.length === 0 || detail.scopeTotal === 0) return null;

	const listed = detail.countries.reduce((s, c) => s + c.count, 0);
	const other = Math.max(0, detail.scopeTotal - listed);
	const max = detail.countries[0]?.count ?? 0;

	return (
		<div className="zt-admin-dashboard__report-countries">
			<h4 className="zt-admin-dashboard__report-subtitle">{t('admin_dashboard.report_countries')}</h4>
			<table className="zt-admin-dashboard__report-table">
				<tbody>
					{detail.countries.map((c) => (
						<tr key={c.country}>
							<th scope="row">{c.country === 'NONE' ? t('admin_dashboard.report_country_unknown') : f.region(c.country) ?? c.country}</th>
							<td className="zt-admin-dashboard__report-cell--wide">
								<CountBar count={c.count} max={max} label={f.num(c.count)} />
							</td>
							<td className="zt-admin-dashboard__report-cell--num">{f.pct(c.count, detail.scopeTotal)}</td>
						</tr>
					))}
					{other > 0 && (
						<tr>
							<th scope="row">{t('admin_dashboard.report_country_other')}</th>
							<td className="zt-admin-dashboard__report-cell--wide">
								<span className="zt-admin-dashboard__report-num">{f.num(other)}</span>
							</td>
							<td className="zt-admin-dashboard__report-cell--num">{f.pct(other, detail.scopeTotal)}</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
