import React from 'react';
import {useTranslation} from 'react-i18next';
import {haversineDistanceKm} from '../../../util/geo';
import {WCA_EVENTS} from './CompetitionEventFilter';
import {MapPin, CalendarBlank, ArrowSquareOut, Users, NavigationArrow} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('competitions');

interface WcaCompetitionData {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	date_range: string;
	event_ids: string[];
	latitude_degrees: number;
	longitude_degrees: number;
	url: string;
	competitor_limit?: number;
}

interface Props {
	competition: WcaCompetitionData;
	userLocation: {lat: number; lon: number} | null;
}

export default function CompetitionRow({competition, userLocation}: Props) {
	const {t} = useTranslation();
	const {name, city, country_iso2, date_range, event_ids, url, latitude_degrees, longitude_degrees, competitor_limit} =
		competition;

	let distanceKm: number | null = null;
	if (userLocation) {
		distanceKm = Math.round(
			haversineDistanceKm(userLocation.lat, userLocation.lon, latitude_degrees, longitude_degrees)
		);
	}

	return (
		<div className={b('row')}>
			<div className={b('row-header')}>
				<a href={url} target="_blank" rel="noopener noreferrer" className={b('row-name')}>
					{name}
					<ArrowSquareOut size={14} weight="bold" />
				</a>
			</div>

			<div className={b('row-meta')}>
				<span className={b('row-meta-item')}>
					<CalendarBlank size={14} />
					{date_range}
				</span>
				<span className={b('row-meta-item')}>
					<MapPin size={14} />
					{city}, {country_iso2}
				</span>
				{competitor_limit && (
					<span className={b('row-meta-item')}>
						<Users size={14} />
						{competitor_limit}
					</span>
				)}
				{distanceKm !== null && (
					<span className={b('row-meta-item', {distance: true})}>
						<NavigationArrow size={14} />
						{distanceKm} km
					</span>
				)}
			</div>

			<div className={b('row-events')}>
				{event_ids.map((eid) => {
					const info = WCA_EVENTS.find((e) => e.code === eid);
					return (
						<span key={eid} className={b('event-badge')}>
							{info?.shortName || eid}
						</span>
					);
				})}
			</div>
		</div>
	);
}
