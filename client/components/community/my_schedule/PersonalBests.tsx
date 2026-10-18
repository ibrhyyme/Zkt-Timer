import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, Info} from 'phosphor-react';
import {gqlQueryTyped} from '../../api';
import {ZktPersonBestsDocument} from '../../../@types/generated/graphql';
import {useCompetitionData} from './CompetitionLoader';
import {useDelayedFlag} from './useDelayedFlag';
import {peekShown, readDeviceCopy, storeCached, markHydrated} from '../competition-cache';
import {ZKT_SHOWN_MAX_AGE} from '../zkt_competitions/shared';
import {b, formatResult, getEventShortName, WcaIdLink, WCA_EVENT_ORDER} from './shared';

interface PersonalBestsProps {
	/** WCA id on a WCA competition; ZKT id, or registration number, on a ZKT one. */
	wcaId: string;
}

type ZktPb = {event_id: string; single?: string | null; average?: string | null};

interface Ranks {
	world: number;
	continental: number;
	national: number;
}

interface RecordRow {
	eventId: string;
	single: string | null;
	average: string | null;
	singleRanks?: Ranks;
	averageRanks?: Ranks;
}

function ranksOf(pb: any): Ranks | undefined {
	return pb ? {world: pb.worldRanking, continental: pb.continentalRanking, national: pb.nationalRanking} : undefined;
}

/**
 * Events the person entered here come first, each group in the official order:
 * a ZKT registration lists its events in no particular order.
 */
function registeredFirst<T extends {eventId: string}>(rows: T[], registered: string[]): T[] {
	const rank = (id: string) => {
		const i = WCA_EVENT_ORDER.indexOf(id);
		const official = i === -1 ? WCA_EVENT_ORDER.length : i;
		return (registered.includes(id) ? 0 : WCA_EVENT_ORDER.length + 1) + official;
	};
	return rows
		.map((row, i) => ({row, i}))
		.sort((a, c) => rank(a.row.eventId) - rank(c.row.eventId) || a.i - c.i)
		.map(({row}) => row);
}

export default function PersonalBests({wcaId}: PersonalBestsProps) {
	const {t} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();

	const isZkt = !!detail?.competitionId?.startsWith('zkt-');
	const person = useMemo(() => {
		if (!detail?.competitors) return null;
		return (
			detail.competitors.find(
				(c: any) =>
					c.wcaId === wcaId ||
					(isZkt && ((c.zktId && c.zktId === wcaId) || String(c.registrantId) === wcaId))
			) || null
		);
	}, [detail, wcaId, isZkt]);

	// A ZKT competition's WCIF only carries the bests set at that competition (and
	// none before it starts), so the records come from the person's federation
	// profile: drawn from the device copy at once, refreshed behind it.
	const zktId: string | null = isZkt ? person?.zktId || null : null;
	const zktKey = zktId ? `zkt-pbs:${zktId}` : null;
	const [zktPbs, setZktPbs] = useState<{key: string; pbs: ZktPb[]} | null>(() => {
		const shown = zktKey ? peekShown<ZktPb[]>(zktKey, ZKT_SHOWN_MAX_AGE) : null;
		return zktKey && shown ? {key: zktKey, pbs: shown} : null;
	});
	const [zktSettled, setZktSettled] = useState<string | null>(null);

	useEffect(() => {
		if (!zktKey || !zktId) return;
		let cancelled = false;
		(async () => {
			markHydrated();
			const cached = await readDeviceCopy<ZktPb[]>(zktKey, ZKT_SHOWN_MAX_AGE);
			if (cancelled) return;
			if (cached) setZktPbs({key: zktKey, pbs: cached.data});
			try {
				const res = await gqlQueryTyped(ZktPersonBestsDocument, {zktId}, {fetchPolicy: 'no-cache'});
				if (cancelled) return;
				// null means the owner hid their records or has no published result.
				const pbs = (res?.data?.zktPersonBests || []).map(({event_id, single, average}) => ({
					event_id,
					single,
					average,
				}));
				storeCached(zktKey, pbs, 'idb');
				setZktPbs({key: zktKey, pbs});
			} catch {
				// keep what is shown
			} finally {
				if (!cancelled) setZktSettled(zktKey);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [zktKey, zktId]);

	const shownZktPbs = zktPbs && zktPbs.key === zktKey ? zktPbs.pbs : null;
	const zktLoading = !!zktKey && !shownZktPbs && zktSettled !== zktKey;
	const showLoading = useDelayedFlag(zktLoading);

	const rows = useMemo((): RecordRow[] => {
		if (!person) return [];
		const registered: string[] = person.registeredEvents || [];

		if (isZkt) {
			return registeredFirst(
				(shownZktPbs || [])
					.filter((pb) => pb.single || pb.average)
					.map((pb) => ({eventId: pb.event_id, single: pb.single || null, average: pb.average || null})),
				registered
			);
		}

		const pbs: any[] = person.personalBests || [];
		const eventIds: string[] = [];
		for (const pb of pbs) if (!eventIds.includes(pb.eventId)) eventIds.push(pb.eventId);
		return registeredFirst(
			eventIds.map((eventId) => {
				const single = pbs.find((pb) => pb.eventId === eventId && pb.type === 'single');
				const average = pbs.find((pb) => pb.eventId === eventId && pb.type === 'average');
				return {
					eventId,
					single: single ? formatResult(single.best, eventId, false) : null,
					average: average ? formatResult(average.best, eventId, true) : null,
					singleRanks: ranksOf(single),
					averageRanks: ranksOf(average),
				};
			}),
			registered
		);
	}, [person, isZkt, shownZktPbs]);

	// ZKT records carry no world, continental or national ranking.
	const showRanks = rows.some((row) =>
		[row.singleRanks, row.averageRanks].some((r) => r && (r.world || r.continental || r.national))
	);

	if (!person) {
		return (
			<div className={b('personal-bests')}>
				<button className={b('back-sm')} onClick={() => history.goBack()}>
					<ArrowLeft size={16} />
					{t('my_schedule.back_to_competitors')}
				</button>
				<div className={b('info-banner')}>
					<Info size={18} />
					<span>{t('my_schedule.competitor_not_found')}</span>
				</div>
			</div>
		);
	}

	const renderRow = (label: string, value: string, ranks?: Ranks) => (
		<tr>
			<td className={b('pb-type')}>{label}</td>
			<td className={b('pb-best')}>{value}</td>
			{showRanks && (
				<>
					<td className={b('pb-rank')}>{ranks?.world}</td>
					<td className={b('pb-rank')}>{ranks?.continental}</td>
					<td className={b('pb-rank', {top: ranks?.national === 1})}>{ranks?.national}</td>
				</>
			)}
		</tr>
	);

	let body: React.ReactNode;
	if (zktLoading) {
		body = showLoading ? (
			<div className={b('wca-live-skeleton')}>
				{[0, 1, 2].map((i) => (
					<div key={i} className={b('wca-live-skeleton-row')} />
				))}
			</div>
		) : null;
	} else if (rows.length === 0) {
		body = (
			<div className={b('info-banner')}>
				<Info size={18} />
				<span>{t(isZkt ? 'my_schedule.no_personal_records' : 'my_schedule.no_rankings')}</span>
			</div>
		);
	} else {
		body = (
			<div className={b('pb-table-wrapper')}>
				<table className={b('pb-table')}>
					<thead>
						<tr>
							<th>{t('my_schedule.pb_type')}</th>
							<th>{t('my_schedule.pb_best')}</th>
							{showRanks && (
								<>
									<th>WR</th>
									<th>CR</th>
									<th>NR</th>
								</>
							)}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<React.Fragment key={row.eventId}>
								<tr className={b('pb-event-row')}>
									<td colSpan={showRanks ? 5 : 2}>{getEventShortName(row.eventId)}</td>
								</tr>
								{row.single && renderRow(t('profile.single'), row.single, row.singleRanks)}
								{row.average && renderRow(t('my_schedule.col_average'), row.average, row.averageRanks)}
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	return (
		<div className={b('personal-bests')}>
			<button className={b('back-sm')} onClick={() => history.goBack()}>
				<ArrowLeft size={16} />
				{t('my_schedule.back_to_competitors')}
			</button>

			{/* Header */}
			<div className={b('pb-header')}>
				<span className={b('pb-name')}>{person.name}</span>
				{person.wcaId ? (
					<WcaIdLink wcaId={person.wcaId} />
				) : (
					person.zktId && <span className={b('pb-zkt-id')}>{person.zktId}</span>
				)}
			</div>

			{body}

			{/* Gorevlerine git butonu */}
			<button
				className={b('pb-assignments-btn')}
				onClick={() => history.push(`/competitions/${detail.competitionId}/persons/${person.registrantId}`)}
			>
				{t('my_schedule.view_assignments')}
			</button>
		</div>
	);
}
