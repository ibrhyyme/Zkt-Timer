import React, {useState} from 'react';
import SelectMenu from '../../common/select_menu/SelectMenu';
import {useTranslation} from 'react-i18next';
import '../wca_results/WcaResults.scss';
import block from '../../../styles/bem';
import LoadingIcon from '../../common/LoadingIcon';
import {intlLocale} from '../../../util/locale_format';

// Reuses the WCA results block and stylesheet: the two histories sit side by
// side on one profile and read the same way, competition by competition.
const b = block('wca-results');

export interface ZktSolve {
	text: string;
	trimmed: boolean;
}

export interface ZktChance {
	chance: number;
	single?: string | null;
	average?: string | null;
	solves: ZktSolve[];
	counting: boolean;
	noShow: boolean;
}

export interface ZktResultRow {
	competitionId: string;
	competitionName: string;
	date: string;
	roundLabel: string;
	roundNumber: number;
	isFinal: boolean;
	ranking?: number | null;
	single?: string | null;
	average?: string | null;
	singleTag?: string | null;
	averageTag?: string | null;
	bestAo5?: string | null;
	chances?: ZktChance[] | null;
	solves: ZktSolve[];
}

export interface ZktResultsData {
	events: {eventId: string; rows: ZktResultRow[]}[];
}

interface Props {
	/** undefined while loading; null or empty when there is nothing to show. */
	data?: ZktResultsData | null;
}

interface CompetitionGroup {
	id: string;
	name: string;
	date: string;
	rows: {eventId: string; row: ZktResultRow}[];
}

/**
 * The federation groups by event; the profile reads by competition, like the
 * WCA history. Events keep the federation's order inside a competition, and
 * each event's rows keep theirs (final first).
 */
function groupByCompetition(events: ZktResultsData['events'], eventFilter: string): CompetitionGroup[] {
	const map = new Map<string, CompetitionGroup>();
	for (const ev of events) {
		if (eventFilter !== 'all' && ev.eventId !== eventFilter) continue;
		for (const row of ev.rows) {
			let group = map.get(row.competitionId);
			if (!group) {
				group = {id: row.competitionId, name: row.competitionName, date: row.date, rows: []};
				map.set(row.competitionId, group);
			}
			group.rows.push({eventId: ev.eventId, row});
		}
	}
	return Array.from(map.values()).sort((a, b) =>
		a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.name.localeCompare(b.name)
	);
}

/** Round name in the viewer's language; the federation's label is Turkish. */
function roundName(row: ZktResultRow, t: any): string {
	const key = row.isFinal ? 'profile.wca_round_f' : `profile.wca_round_${row.roundNumber}`;
	const translated = t(key);
	const base = translated !== key ? translated : String(row.roundNumber);
	// The federation appends " · <day>" only where two rows of one competition
	// would otherwise share a round name. The day is an organizer-entered name.
	const sep = row.roundLabel.indexOf(' · ');
	return sep >= 0 ? `${base} · ${row.roundLabel.slice(sep + 3)}` : base;
}

function Solves({solves}: {solves: ZktSolve[]}) {
	return (
		<>
			{solves.map((s, i) => (
				<span key={i} className={b('attempt')}>
					{s.trimmed ? `(${s.text})` : s.text}
				</span>
			))}
		</>
	);
}

function RecordTag({tag}: {tag?: string | null}) {
	if (!tag) return null;
	return <span className={b('record-tag', {[tag.toLowerCase()]: true})}>{tag}</span>;
}

export default function ZktResults({data}: Props) {
	const {t, i18n} = useTranslation();
	const [eventFilter, setEventFilter] = useState<string>('all');

	if (data === undefined) {
		return (
			<div className={b({loading: true})}>
				<LoadingIcon />
			</div>
		);
	}

	const events = data?.events || [];
	if (!events.some((ev) => ev.rows.length > 0)) {
		return (
			<div className={b('empty')}>
				<p>{t('profile.wca_no_results')}</p>
			</div>
		);
	}

	const groups = groupByCompetition(events, eventFilter);
	const formatDate = (iso: string) =>
		new Date(`${iso}T00:00:00Z`).toLocaleDateString(intlLocale(i18n.language), {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC',
		});

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h3>{t('profile.zkt_results_title')}</h3>
				<div className={b('filter')}>
					<SelectMenu
						value={eventFilter}
						onChange={setEventFilter}
						className={b('filter-select')}
						ariaLabel={t('profile.wca_all_events')}
						align="end"
						options={[
							{value: 'all', label: t('profile.wca_all_events')},
							...events.map((ev) => ({value: ev.eventId, label: t(`wca_events.${ev.eventId}`, ev.eventId)})),
						]}
					/>
				</div>
			</div>

			{groups.map((group) => (
				<div key={group.id} className={b('competition')}>
					<div className={b('comp-header')}>
						<span className={b('comp-name')}>{group.name}</span>
						<span className={b('comp-date')}>{formatDate(group.date)}</span>
					</div>
					<div className={b('table-wrapper')}>
						<table className={b('table')}>
							<thead>
								<tr>
									<th>{t('profile.wca_event_col')}</th>
									<th>{t('profile.wca_round_col')}</th>
									<th>{t('profile.wca_place')}</th>
									<th>{t('profile.single')}</th>
									<th>{t('profile.average')}</th>
									<th>{t('profile.wca_solves_col')}</th>
								</tr>
							</thead>
							<tbody>
								{group.rows.map(({eventId, row}, i) => (
									<tr key={`${eventId}-${row.roundLabel}-${i}`}>
										<td className={b('event-cell')}>{t(`wca_events.${eventId}`, eventId)}</td>
										<td>{roundName(row, t)}</td>
										<td className={b('pos-cell')}>{row.ranking ?? ''}</td>
										<td className={b('time-cell')}>
											{row.single || '—'}
											<RecordTag tag={row.singleTag} />
										</td>
										<td className={b('time-cell')}>
											{row.average || '—'}
											{/* On an Ao12 row the average tag belongs to the best Ao5. */}
											{!row.bestAo5 && <RecordTag tag={row.averageTag} />}
											{row.bestAo5 && (
												<span className={b('sub')}>
													Ao5 {row.bestAo5}
													<RecordTag tag={row.averageTag} />
												</span>
											)}
										</td>
										<td className={b('solves-cell')}>
											{row.chances && row.chances.length > 0 ? (
												row.chances.map((c) => (
													<div key={c.chance} className={b('chance', {counting: c.counting})}>
														<span className={b('chance-label')}>
															{t('zkt_comp.chance_n', {n: c.chance})}
														</span>
														{c.noShow ? <span className={b('attempt')}>DNS</span> : <Solves solves={c.solves} />}
													</div>
												))
											) : (
												<Solves solves={row.solves} />
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			))}
		</div>
	);
}
