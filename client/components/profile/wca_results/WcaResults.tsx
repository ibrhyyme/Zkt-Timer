import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './WcaResults.scss';
import block from '../../../styles/bem';
import LoadingIcon from '../../common/LoadingIcon';

const b = block('wca-results');

interface WcaResultItem {
	competition_id: string;
	competition_name: string;
	competition_date: string;
	event_id: string;
	round_type_id: string;
	pos: number;
	best: number;
	average: number;
	attempts: number[];
	regional_single_record?: string;
	regional_average_record?: string;
}

interface Props {
	wcaId: string;
	data?: WcaResultItem[];
}

function formatTime(cs: number): string {
	if (cs <= 0 || cs === -1) return 'DNF';
	if (cs === -2) return 'DNS';

	const minutes = Math.floor(cs / 6000);
	const seconds = Math.floor((cs % 6000) / 100);
	const centis = cs % 100;

	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
	}
	return `${seconds}.${centis.toString().padStart(2, '0')}`;
}

function formatAttempts(attempts: number[], bestIndex?: number, worstIndex?: number): React.ReactNode[] {
	if (!attempts || !attempts.length) return [];

	// best ve worst index'lerini bul (average icin paranteze alinir)
	let best = -1;
	let worst = -1;

	if (attempts.length === 5) {
		let minVal = Infinity;
		let maxVal = -Infinity;
		attempts.forEach((a, i) => {
			const val = a <= 0 ? Infinity : a;
			if (val < minVal) { minVal = val; best = i; }
		});
		attempts.forEach((a, i) => {
			const val = a <= 0 ? Infinity : a;
			if (val > maxVal || (val === Infinity && a <= 0)) { maxVal = val; worst = i; }
		});
	}

	return attempts.map((a, i) => {
		const time = formatTime(a);
		const isBest = i === best;
		const isWorst = i === worst;
		const showParens = attempts.length === 5 && (isBest || isWorst);

		return (
			<span key={i} className={b('attempt', { best: isBest, worst: isWorst })}>
				{showParens ? `(${time})` : time}
			</span>
		);
	});
}

function getRoundName(roundTypeId: string, t: any): string {
	const key = `profile.wca_round_${roundTypeId}`;
	const translated = t(key);
	return translated !== key ? translated : roundTypeId;
}

function formatCompDate(dateStr: string): string {
	if (!dateStr) return '';
	const d = new Date(dateStr);
	return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Yarisma bazli gruplama
interface CompetitionGroup {
	id: string;
	name: string;
	date: string;
	results: WcaResultItem[];
}

function groupByCompetition(results: WcaResultItem[]): CompetitionGroup[] {
	const map = new Map<string, CompetitionGroup>();

	for (const r of results) {
		if (!map.has(r.competition_id)) {
			map.set(r.competition_id, {
				id: r.competition_id,
				name: r.competition_name,
				date: r.competition_date,
				results: [],
			});
		}
		map.get(r.competition_id).results.push(r);
	}

	return Array.from(map.values());
}

export default function WcaResults({ wcaId, data }: Props) {
	const { t } = useTranslation();
	const [eventFilter, setEventFilter] = useState<string>('all');

	const results = data || [];

	if (!data) {
		return (
			<div className={b({ loading: true })}>
				<LoadingIcon />
			</div>
		);
	}

	if (!results.length) {
		return (
			<div className={b('empty')}>
				<p>{t('profile.wca_no_results')}</p>
			</div>
		);
	}

	// Unique event'leri cek (filtre icin)
	const uniqueEvents = Array.from(new Set(results.map((r) => r.event_id)));

	// Filtre uygula
	const filtered = eventFilter === 'all' ? results : results.filter((r) => r.event_id === eventFilter);

	// Yarisma bazli grupla
	const groups = groupByCompetition(filtered);

	return (
		<div className={b()}>
			<div className={b('header')}>
				<h3>{t('profile.wca_results_title')}</h3>
				<div className={b('filter')}>
					<select
						value={eventFilter}
						onChange={(e) => setEventFilter(e.target.value)}
						className={b('filter-select')}
					>
						<option value="all">{t('profile.wca_all_events')}</option>
						{uniqueEvents.map((ev) => (
							<option key={ev} value={ev}>
								{t(`wca_events.${ev}`, ev)}
							</option>
						))}
					</select>
				</div>
			</div>

			{groups.map((group) => (
				<div key={group.id} className={b('competition')}>
					<div className={b('comp-header')}>
						<span className={b('comp-name')}>{group.name}</span>
						<span className={b('comp-date')}>{formatCompDate(group.date)}</span>
					</div>
					<div className={b('table-wrapper')}>
						<table className={b('table')}>
							<thead>
								<tr>
									<th>{t('profile.wca_event_col')}</th>
									<th>{t('profile.wca_round_col')}</th>
									<th>{t('profile.wca_place')}</th>
									<th>Single</th>
									<th>Average</th>
									<th>{t('profile.wca_solves_col')}</th>
								</tr>
							</thead>
							<tbody>
								{group.results.map((r, i) => (
									<tr key={i}>
										<td className={b('event-cell')}>
											{t(`wca_events.${r.event_id}`, r.event_id)}
										</td>
										<td>{getRoundName(r.round_type_id, t)}</td>
										<td className={b('pos-cell')}>{r.pos}</td>
										<td className={b('time-cell')}>
											{formatTime(r.best)}
											{r.regional_single_record && (
												<span className={b('record-tag', { [r.regional_single_record.toLowerCase()]: true })}>
													{r.regional_single_record}
												</span>
											)}
										</td>
										<td className={b('time-cell')}>
											{formatTime(r.average)}
											{r.regional_average_record && (
												<span className={b('record-tag', { [r.regional_average_record.toLowerCase()]: true })}>
													{r.regional_average_record}
												</span>
											)}
										</td>
										<td className={b('solves-cell')}>
											{formatAttempts(r.attempts)}
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
