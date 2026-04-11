import React, {useEffect, useState, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import Header from '../../layout/header/Header';
import {gqlQueryTyped} from '../../api';
import {WcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {haversineDistanceKm} from '../../../util/geo';
import CompetitionEventFilter, {WCA_EVENTS} from './CompetitionEventFilter';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {MagnifyingGlass} from 'phosphor-react';
import block from '../../../styles/bem';
import './Competitions.scss';

const b = block('competitions');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface GeoPlace {
	lat: string;
	lon: string;
	display_name: string;
}

interface UserLocation {
	lat: number;
	lon: number;
	name: string;
}

const I18N_LOCALE_MAP: Record<string, string> = {
	tr: 'tr-TR',
	en: 'en-US',
	es: 'es-ES',
	ru: 'ru-RU',
};

function formatDateRange(startDate: string, endDate: string, lang: string): string {
	const locale = I18N_LOCALE_MAP[lang] || lang;
	const start = new Date(startDate + 'T00:00:00');
	const end = new Date(endDate + 'T00:00:00');

	const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, opts);

	if (startDate === endDate) {
		return fmt(start, {day: 'numeric', month: 'short', year: 'numeric'});
	}

	if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
		return `${fmt(start, {day: 'numeric'})} - ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}`;
	}

	return `${fmt(start, {day: 'numeric', month: 'short'})} - ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}`;
}

export default function Competitions() {
	const {t, i18n} = useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);

	const [competitions, setCompetitions] = useState<any[] | null>(null);
	const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
	const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [places, setPlaces] = useState<GeoPlace[] | null>(null);
	const [searching, setSearching] = useState(false);

	useEffect(() => {
		fetchCompetitions();
	}, []);

	async function fetchCompetitions() {
		try {
			const res = await gqlQueryTyped(WcaCompetitionsDocument, {filter: {}}, {fetchPolicy: 'no-cache'});
			setCompetitions(res.data?.wcaCompetitions || []);
		} catch {
			setCompetitions([]);
		}
	}

	async function handleFind() {
		const query = searchQuery.trim();
		if (!query) return;

		setSearching(true);
		setPlaces(null);

		try {
			const res = await fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5`);
			const data: GeoPlace[] = await res.json();
			if (data.length === 1) {
				selectPlace(data[0]);
			} else {
				setPlaces(data);
			}
		} catch {
			setPlaces([]);
		}

		setSearching(false);
	}

	function selectPlace(place: GeoPlace) {
		setUserLocation({
			lat: parseFloat(place.lat),
			lon: parseFloat(place.lon),
			name: place.display_name,
		});
		setPlaces(null);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter') {
			handleFind();
		}
	}

	let displayList = competitions || [];

	if (selectedEvent) {
		displayList = displayList.filter((c) => c.event_ids?.includes(selectedEvent));
	}

	if (userLocation) {
		displayList = [...displayList].sort((a, b) => {
			const distA = haversineDistanceKm(userLocation.lat, userLocation.lon, a.latitude_degrees, a.longitude_degrees);
			const distB = haversineDistanceKm(userLocation.lat, userLocation.lon, b.latitude_degrees, b.longitude_degrees);
			return distA - distB;
		});
	}

	let body: React.ReactNode;
	if (competitions === null) {
		body = <Loading />;
	} else if (displayList.length === 0) {
		body = <p className={b('empty')}>{t('competitions.no_results')}</p>;
	} else {
		body = (
			<div className={b('table-wrapper')}>
				<table className={b('table')}>
					<thead>
						<tr>
							<th>{t('competitions.col_date')}</th>
							{userLocation && <th>{t('competitions.col_distance')}</th>}
							<th>{t('competitions.col_name')}</th>
							<th>{t('competitions.col_events')}</th>
						</tr>
					</thead>
					<tbody>
						{displayList.map((comp) => {
							const km = userLocation
								? Math.round(
										haversineDistanceKm(
											userLocation.lat,
											userLocation.lon,
											comp.latitude_degrees,
											comp.longitude_degrees
										)
								  )
								: null;

							const eventNames = (comp.event_ids || [])
								.map((eid: string) => {
									const info = WCA_EVENTS.find((e) => e.code === eid);
									return info?.shortName || eid;
								})
								.join(' ');

							return (
								<tr key={comp.id}>
									<td className={b('date-cell')}>{formatDateRange(comp.start_date, comp.end_date, i18n.language)}</td>
									{userLocation && <td className={b('km-cell')}>{km}</td>}
									<td>
										<a
											href={comp.url}
											target="_blank"
											rel="noopener noreferrer"
											className={b('link')}
										>
											{comp.name}
										</a>
									</td>
									<td className={b('events-cell')}>{eventNames}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

	return (
		<div className={b()}>
			<Header path="/community/competitions" title={t('competitions.page_title')} />
			<div className={b('content')}>
				<div className={b('search')}>
					<input
						ref={inputRef}
						type="text"
						className={b('search-input')}
						placeholder={t('competitions.search_placeholder')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					<Button
						text={t('competitions.find')}
						primary
						small
						onClick={handleFind}
						loading={searching}
					/>
				</div>

				<p className={b('search-hint')}>{t('competitions.search_hint')}</p>

				{places && places.length > 0 && (
					<div className={b('places')}>
						{places.map((place, i) => (
							<button key={i} className={b('place')} onClick={() => selectPlace(place)}>
								{place.display_name}
							</button>
						))}
					</div>
				)}

				{places && places.length === 0 && (
					<p className={b('search-error')}>{t('competitions.search_error')}</p>
				)}

				{userLocation && (
					<p className={b('location-info')}>
						{userLocation.name}
					</p>
				)}

				<CompetitionEventFilter selectedEvent={selectedEvent} onSelect={setSelectedEvent} />

				{competitions && (
					<span className={b('results-count')}>
						{t('competitions.results_count', {count: displayList.length})}
					</span>
				)}

				{body}
			</div>
		</div>
	);
}
