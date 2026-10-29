import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useLocation} from 'react-router-dom';
import {useQuery} from '@apollo/client';
import block from '../../../styles/bem';
import Loading from '../../common/loading/Loading';
import Empty from '../../common/empty/Empty';
import TabBar from '../../common/tab_bar/TabBar';
import {
	RegistrationWatchCompetitionDocument,
	RegistrationWatchCompetitionQuery,
	RegistrationWatchCompetitionsDocument,
	RegistrationWatchCompetitionFragmentFragment,
} from '../../../@types/generated/graphql';
import {formatWatchDay, formatWatchMoment, missingRegistrantIds} from './registration_watch';
import './AdminRegistrationWatch.scss';

const b = block('admin-regwatch');

type Competition = RegistrationWatchCompetitionFragmentFragment;
type Detail = NonNullable<RegistrationWatchCompetitionQuery['registrationWatchCompetition']>;
type WatchEvent = NonNullable<NonNullable<Detail['events']>[number]>;
type Registrant = NonNullable<NonNullable<Detail['registrants']>[number]>;
type View = 'changes' | 'list';

export default function AdminRegistrationWatch() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const selected = new URLSearchParams(location.search).get('c');

	const {data, loading, error} = useQuery(RegistrationWatchCompetitionsDocument, {fetchPolicy: 'cache-and-network'});
	const competitions = (data?.registrationWatchCompetitions || []).filter(Boolean) as Competition[];

	function select(id: string) {
		history.replace({search: `?c=${encodeURIComponent(id)}`});
	}

	if (error) {
		return <Empty text={t('admin_registration_watch.no_access')} />;
	}

	return (
		<div className={b()}>
			<header className={b('header')}>
				<h2 className={b('title')}>{t('admin_registration_watch.title')}</h2>
				<p className={b('lead')}>{t('admin_registration_watch.lead')}</p>
			</header>

			{loading && !data ? (
				<Loading />
			) : competitions.length === 0 ? (
				<Empty text={t('admin_registration_watch.no_competitions')} />
			) : (
				<div className={b('layout')}>
					<ul className={b('list')}>
						{competitions.map((c) => (
							<li key={c.competition_id}>
								<CompetitionRow comp={c} active={c.competition_id === selected} onSelect={select} />
							</li>
						))}
					</ul>
					<div className={b('detail')}>
						{selected ? (
							<CompetitionDetail competitionId={selected} />
						) : (
							<p className={b('hint')}>{t('admin_registration_watch.pick_competition')}</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function CompetitionRow(props: {comp: Competition; active: boolean; onSelect: (id: string) => void}) {
	const {comp, active, onSelect} = props;
	const {t, i18n} = useTranslation();
	const limit = comp.competitor_limit ? ` / ${comp.competitor_limit}` : '';

	return (
		<button type="button" className={b('row', {active})} onClick={() => onSelect(comp.competition_id)}>
			<span className={b('row-name')}>{comp.name}</span>
			<span className={b('row-dates')}>
				{formatWatchDay(comp.start_date, i18n.language)}
				{comp.end_date !== comp.start_date ? ` - ${formatWatchDay(comp.end_date, i18n.language)}` : ''}
			</span>
			<span className={b('row-stats')}>
				<span>
					{t('admin_registration_watch.competitors')}: <b>{comp.accepted_count}{limit}</b>
				</span>
				<span>
					{t('admin_registration_watch.changes')}: <b>{comp.event_count}</b>
				</span>
				{comp.flagged_count > 0 && (
					<span className={b('row-flagged')}>
						{t('admin_registration_watch.flagged')}: <b>{comp.flagged_count}</b>
					</span>
				)}
			</span>
			{!comp.baseline_at && <span className={b('row-pending')}>{t('admin_registration_watch.not_read_yet')}</span>}
		</button>
	);
}

function CompetitionDetail({competitionId}: {competitionId: string}) {
	const {t, i18n} = useTranslation();
	const [view, setView] = useState<View>('changes');
	const {data, loading} = useQuery(RegistrationWatchCompetitionDocument, {
		variables: {competitionId},
		fetchPolicy: 'cache-and-network',
	});
	const detail = data?.registrationWatchCompetition;

	if (loading && !detail) return <Loading />;
	if (!detail?.competition) return <Empty text={t('admin_registration_watch.not_found')} />;

	const comp = detail.competition;
	const events = (detail.events || []).filter(Boolean) as WatchEvent[];
	const registrants = (detail.registrants || []).filter(Boolean) as Registrant[];
	const lang = i18n.language;

	return (
		<section className={b('panel')}>
			<div className={b('panel-head')}>
				<h3 className={b('panel-title')}>{comp.name}</h3>
				<a
					className={b('wca-link')}
					href={`https://www.worldcubeassociation.org/competitions/${encodeURIComponent(comp.competition_id)}/registrations`}
					target="_blank"
					rel="noopener noreferrer"
				>
					{t('admin_registration_watch.open_on_wca')}
				</a>
			</div>

			<dl className={b('facts')}>
				<Fact label={t('admin_registration_watch.registration_close')} value={formatWatchMoment(comp.registration_close, lang)} />
				<Fact label={t('admin_registration_watch.groups_seen')} value={formatWatchMoment(comp.groups_seen_at, lang)} />
				<Fact label={t('admin_registration_watch.watching_since')} value={formatWatchMoment(comp.baseline_at, lang)} />
				<Fact label={t('admin_registration_watch.last_check')} value={formatWatchMoment(comp.confirmed_at, lang)} />
			</dl>

			<TabBar<View>
				label={t('admin_registration_watch.title')}
				value={view}
				onChange={setView}
				tabs={[
					{id: 'changes', label: `${t('admin_registration_watch.changes')} (${events.length})`},
					{id: 'list', label: `${t('admin_registration_watch.current_list')} (${registrants.length})`},
				]}
			/>

			{view === 'changes' ? (
				<ChangeList events={events} baselineAt={comp.baseline_at} />
			) : (
				<CurrentList registrants={registrants} />
			)}
		</section>
	);
}

function Fact({label, value}: {label: string; value: string | null}) {
	const {t} = useTranslation();
	return (
		<div className={b('fact')}>
			<dt>{label}</dt>
			<dd>{value || t('admin_registration_watch.unknown')}</dd>
		</div>
	);
}

function ChangeList({events, baselineAt}: {events: WatchEvent[]; baselineAt?: string | null}) {
	const {t, i18n} = useTranslation();
	const lang = i18n.language;

	return (
		<div className={b('changes')}>
			{baselineAt && (
				<p className={b('note')}>
					{t('admin_registration_watch.baseline_note', {date: formatWatchMoment(baselineAt, lang)})}
				</p>
			)}
			{events.length === 0 ? (
				<p className={b('hint')}>{t('admin_registration_watch.no_changes')}</p>
			) : (
				<ul className={b('events')}>
					{events.map((e) => (
						<li key={e.id} className={b('event')}>
							<div className={b('event-main')}>
								<span className={b('kind', {[e.kind]: true})}>{t(`admin_registration_watch.kind_${e.kind}`)}</span>
								<span className={b('event-name')}>{e.name}</span>
								{e.wca_id ? (
									<span className={b('mono')}>{e.wca_id}</span>
								) : (
									<span className={b('muted')}>{t('admin_registration_watch.newcomer')}</span>
								)}
								{e.registrant_id != null && (
									<span className={b('muted')}>
										{t('admin_registration_watch.registrant_no')} <span className={b('mono')}>{e.registrant_id}</span>
									</span>
								)}
							</div>
							<div className={b('event-when')}>
								{e.window_start
									? t('admin_registration_watch.window', {
											from: formatWatchMoment(e.window_start, lang),
											to: formatWatchMoment(e.observed_at, lang),
									  })
									: t('admin_registration_watch.seen_at', {date: formatWatchMoment(e.observed_at, lang)})}
							</div>
							{e.kind === 'events_changed' && (
								<div className={b('mono')}>
									{(e.events_before || []).join(', ')} → {(e.events_after || []).join(', ')}
								</div>
							)}
							{(e.after_close || e.after_groups) && (
								<div className={b('chips')}>
									{e.after_close && <span className={b('chip')}>{t('admin_registration_watch.after_close')}</span>}
									{e.after_groups && <span className={b('chip')}>{t('admin_registration_watch.after_groups')}</span>}
								</div>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function CurrentList({registrants}: {registrants: Registrant[]}) {
	const {t, i18n} = useTranslation();
	const unstaffedCount = registrants.filter((r) => r.unstaffed).length;
	const missing = useMemo(() => missingRegistrantIds(registrants.map((r) => r.registrant_id)), [registrants]);

	if (registrants.length === 0) {
		return <p className={b('hint')}>{t('admin_registration_watch.no_registrants')}</p>;
	}

	return (
		<div className={b('current')}>
			{unstaffedCount > 0 && (
				<p className={b('note')}>{t('admin_registration_watch.unstaffed_note', {n: unstaffedCount})}</p>
			)}
			{missing.length > 0 && (
				<p className={b('note')}>
					{t('admin_registration_watch.missing_numbers')}: <span className={b('mono')}>{missing.join(', ')}</span>
				</p>
			)}
			<div className={b('table-wrap')}>
				<table className={b('table')}>
					<thead>
						<tr>
							<th>{t('admin_registration_watch.registrant_no')}</th>
							<th>{t('admin_registration_watch.name')}</th>
							<th>WCA ID</th>
							<th>{t('admin_registration_watch.events')}</th>
							<th>{t('admin_registration_watch.groups')}</th>
							<th>{t('admin_registration_watch.tasks')}</th>
							<th>{t('admin_registration_watch.first_seen')}</th>
						</tr>
					</thead>
					<tbody>
						{registrants.map((r) => (
							<tr key={r.wca_registration_id} className={b('tr', {unstaffed: r.unstaffed})}>
								<td className={b('mono')}>{r.registrant_id ?? ''}</td>
								<td>
									{r.name}
									{r.unstaffed && <span className={b('chip')}>{t('admin_registration_watch.unstaffed')}</span>}
								</td>
								<td className={b('mono')}>{r.wca_id || t('admin_registration_watch.newcomer')}</td>
								<td className={b('mono')}>{(r.event_ids || []).join(', ')}</td>
								<td className={b('mono')}>{r.competitor_groups}</td>
								<td className={b('mono')}>{r.staff_tasks}</td>
								<td className={b('mono')}>{formatWatchMoment(r.first_seen_at, i18n.language)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
