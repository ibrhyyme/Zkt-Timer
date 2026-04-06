import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, Info} from 'phosphor-react';
import {useCompetitionData} from './CompetitionLoader';
import {b, formatWcaTime, getEventShortName} from './shared';

interface PersonalBestsProps {
	wcaId: string;
}

export default function PersonalBests({wcaId}: PersonalBestsProps) {
	const {t} = useTranslation();
	const history = useHistory();
	const {detail} = useCompetitionData();

	const person = useMemo(() => {
		if (!detail?.competitors) return null;
		return detail.competitors.find((c: any) => c.wcaId === wcaId) || null;
	}, [detail, wcaId]);

	// Event bazli gruplama
	const eventData = useMemo(() => {
		if (!person?.personalBests?.length) return [];
		const events = person.registeredEvents || [];
		const result: any[] = [];

		for (const eventId of events) {
			const single = person.personalBests.find((pb: any) => pb.eventId === eventId && pb.type === 'single');
			const average = person.personalBests.find((pb: any) => pb.eventId === eventId && pb.type === 'average');
			if (single || average) {
				result.push({eventId, eventName: getEventShortName(eventId), single, average});
			}
		}

		// Kayitli olmayan ama PB'si olan eventler
		const registeredSet = new Set(events);
		const otherEvents = new Set<string>();
		for (const pb of person.personalBests) {
			if (!registeredSet.has(pb.eventId)) otherEvents.add(pb.eventId);
		}
		for (const eventId of otherEvents) {
			const single = person.personalBests.find((pb: any) => pb.eventId === eventId && pb.type === 'single');
			const average = person.personalBests.find((pb: any) => pb.eventId === eventId && pb.type === 'average');
			if (single || average) {
				result.push({eventId, eventName: getEventShortName(eventId), single, average});
			}
		}

		return result;
	}, [person]);

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

	return (
		<div className={b('personal-bests')}>
			<button className={b('back-sm')} onClick={() => history.goBack()}>
				<ArrowLeft size={16} />
				{t('my_schedule.back_to_competitors')}
			</button>

			{/* Header */}
			<div className={b('pb-header')}>
				<span className={b('pb-name')}>{person.name}</span>
				{person.wcaId && <span className={b('pb-wca-id')}>{person.wcaId}</span>}
			</div>

			{eventData.length === 0 ? (
				<div className={b('info-banner')}>
					<Info size={18} />
					<span>{t('my_schedule.no_rankings')}</span>
				</div>
			) : (
				<div className={b('pb-table-wrapper')}>
					<table className={b('pb-table')}>
						<thead>
							<tr>
								<th>{t('my_schedule.pb_type')}</th>
								<th>{t('my_schedule.pb_best')}</th>
								<th>WR</th>
								<th>CR</th>
								<th>NR</th>
							</tr>
						</thead>
						<tbody>
							{eventData.map((ev: any) => (
								<React.Fragment key={ev.eventId}>
									{/* Event header row */}
									<tr className={b('pb-event-row')}>
										<td colSpan={5}>{ev.eventName}</td>
									</tr>
									{ev.single && (
										<tr>
											<td className={b('pb-type')}>single</td>
											<td className={b('pb-best')}>{formatWcaTime(ev.single.best)}</td>
											<td className={b('pb-rank')}>{ev.single.worldRanking}</td>
											<td className={b('pb-rank')}>{ev.single.continentalRanking}</td>
											<td className={b('pb-rank', {top: ev.single.nationalRanking === 1})}>{ev.single.nationalRanking}</td>
										</tr>
									)}
									{ev.average && (
										<tr>
											<td className={b('pb-type')}>average</td>
											<td className={b('pb-best')}>{formatWcaTime(ev.average.best)}</td>
											<td className={b('pb-rank')}>{ev.average.worldRanking}</td>
											<td className={b('pb-rank')}>{ev.average.continentalRanking}</td>
											<td className={b('pb-rank', {top: ev.average.nationalRanking === 1})}>{ev.average.nationalRanking}</td>
										</tr>
									)}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Gorevlerine git butonu */}
			<button
				className={b('pb-assignments-btn')}
				onClick={() => {
					const comp = detail.competitors.find((c: any) => c.wcaId === wcaId);
					if (comp) history.push(`/community/competitions/${detail.competitionId}/persons/${comp.registrantId}`);
				}}
			>
				{t('my_schedule.view_assignments')}
			</button>
		</div>
	);
}
