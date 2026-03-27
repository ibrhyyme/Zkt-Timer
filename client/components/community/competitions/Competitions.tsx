import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import Header from '../../layout/header/Header';
import {gqlQueryTyped} from '../../api';
import {WcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {haversineDistanceKm} from '../../../util/geo';
import CompetitionRow from './CompetitionRow';
import CompetitionEventFilter from './CompetitionEventFilter';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import {Crosshair} from 'phosphor-react';
import block from '../../../styles/bem';
import './Competitions.scss';

const b = block('competitions');

interface UserLocation {
	lat: number;
	lon: number;
}

export default function Competitions() {
	const {t} = useTranslation();

	const [competitions, setCompetitions] = useState<any[] | null>(null);
	const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
	const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
	const [locationLoading, setLocationLoading] = useState(false);
	const [locationError, setLocationError] = useState(false);

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

	function requestLocation() {
		if (!navigator.geolocation) {
			setLocationError(true);
			return;
		}
		setLocationLoading(true);
		setLocationError(false);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setUserLocation({lat: pos.coords.latitude, lon: pos.coords.longitude});
				setLocationLoading(false);
			},
			() => {
				setLocationError(true);
				setLocationLoading(false);
			}
		);
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
			<div className={b('list')}>
				{displayList.map((comp) => (
					<CompetitionRow key={comp.id} competition={comp} userLocation={userLocation} />
				))}
			</div>
		);
	}

	return (
		<div className={b()}>
			<Header path="/community/competitions" title={t('competitions.page_title')} />
			<div className={b('content')}>
				<div className={b('toolbar')}>
					<Button
						icon={<Crosshair />}
						iconFirst
						text={userLocation ? t('competitions.location_active') : t('competitions.use_my_location')}
						onClick={requestLocation}
						loading={locationLoading}
						primary={!!userLocation}
						gray={!userLocation}
						small
					/>
					{locationError && <span className={b('location-error')}>{t('competitions.location_error')}</span>}
				</div>

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
