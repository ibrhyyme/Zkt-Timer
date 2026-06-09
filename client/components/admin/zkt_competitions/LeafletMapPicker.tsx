import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {b} from './shared';
import {MagnifyingGlass} from 'phosphor-react';

/**
 * Click-to-pick location map with address search. Leaflet is loaded lazily from
 * a CDN (jsDelivr) — no npm dependency, SSR-safe (all runs in useEffect).
 * Clicking the map or searching an address drops/moves a marker and reports
 * lat/lng up. Address search uses the OpenStreetMap Nominatim API.
 */

const LEAFLET_VERSION = '1.9.4';
const CDN = `https://cdn.jsdelivr.net/npm/leaflet@${LEAFLET_VERSION}/dist`;

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
	if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
	if ((window as any).L) return Promise.resolve((window as any).L);
	if (leafletPromise) return leafletPromise;

	leafletPromise = new Promise((resolve, reject) => {
		let cssReady = false;
		let jsReady = false;
		const maybeResolve = () => {
			if (cssReady && jsReady) resolve((window as any).L);
		};

		// CSS must be present BEFORE the map initialises, otherwise tiles render
		// with the wrong size/position (the broken grid we saw).
		const existingCss = document.getElementById('leaflet-css') as HTMLLinkElement | null;
		if (existingCss) {
			cssReady = true;
		} else {
			const link = document.createElement('link');
			link.id = 'leaflet-css';
			link.rel = 'stylesheet';
			link.href = `${CDN}/leaflet.css`;
			link.onload = () => {
				cssReady = true;
				maybeResolve();
			};
			// Proceed even if onload doesn't fire (some browsers); the stylesheet
			// still applies once parsed.
			link.onerror = () => {
				cssReady = true;
				maybeResolve();
			};
			document.head.appendChild(link);
		}

		const script = document.createElement('script');
		script.src = `${CDN}/leaflet.js`;
		script.async = true;
		script.onload = () => {
			jsReady = true;
			maybeResolve();
		};
		script.onerror = () => {
			leafletPromise = null;
			reject(new Error('leaflet load failed'));
		};
		document.body.appendChild(script);

		maybeResolve();
	});
	return leafletPromise;
}

// Default Leaflet marker icons are referenced relatively and break when loaded
// from a CDN; point them explicitly at the CDN images.
function makeIcon(L: any) {
	return L.icon({
		iconUrl: `${CDN}/images/marker-icon.png`,
		iconRetinaUrl: `${CDN}/images/marker-icon-2x.png`,
		shadowUrl: `${CDN}/images/marker-shadow.png`,
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
	});
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

interface Props {
	lat: number | null;
	lng: number | null;
	onChange: (lat: number, lng: number) => void;
}

export default function LeafletMapPicker({lat, lng, onChange}: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const markerRef = useRef<any>(null);
	const iconRef = useRef<any>(null);
	const resizeObsRef = useRef<any>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const [search, setSearch] = useState('');
	const [searching, setSearching] = useState(false);

	function placeMarker(L: any, map: any, la: number, lo: number) {
		if (markerRef.current) {
			markerRef.current.setLatLng([la, lo]);
		} else {
			markerRef.current = L.marker([la, lo], {icon: iconRef.current}).addTo(map);
		}
	}

	// Init once.
	useEffect(() => {
		let cancelled = false;
		loadLeaflet()
			.then((L) => {
				if (cancelled || !containerRef.current || mapRef.current) return;
				iconRef.current = makeIcon(L);
				const startLat = lat ?? 39.0;
				const startLng = lng ?? 35.2;
				const zoom = lat != null && lng != null ? 14 : 6;
				const map = L.map(containerRef.current).setView([startLat, startLng], zoom);
				// CARTO basemap — OSM's own tile server rendered broken/partial grids
				// here; CARTO is the provider used by WCA tooling and more tolerant.
				L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
					attribution: '© OpenStreetMap © CARTO',
					subdomains: 'abcd',
					maxZoom: 19,
				}).addTo(map);
				mapRef.current = map;

				if (lat != null && lng != null) placeMarker(L, map, lat, lng);

				map.on('click', (e: any) => {
					const la = round6(e.latlng.lat);
					const lo = round6(e.latlng.lng);
					placeMarker(L, map, la, lo);
					onChangeRef.current(la, lo);
				});

				// Tiles render blank/misaligned if the container's real size isn't
				// settled at init (form/SubSection lays out late). A ResizeObserver
				// catches the moment the size actually changes — far more reliable
				// than guessing with setTimeout.
				if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
					const ro = new ResizeObserver(() => {
						if (mapRef.current) mapRef.current.invalidateSize();
					});
					ro.observe(containerRef.current);
					resizeObsRef.current = ro;
				}
				// First post-layout frame + timeouts as a belt-and-suspenders fallback.
				requestAnimationFrame(() => map.invalidateSize());
				setTimeout(() => map.invalidateSize(), 200);
				setTimeout(() => map.invalidateSize(), 700);
			})
			.catch(() => {
				/* CDN blocked / offline — manual lat/long inputs remain usable. */
			});

		return () => {
			cancelled = true;
			if (resizeObsRef.current) {
				resizeObsRef.current.disconnect();
				resizeObsRef.current = null;
			}
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				markerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// React to external lat/lng changes (manual input edits).
	useEffect(() => {
		const map = mapRef.current;
		const L = (window as any).L;
		if (!map || !L || lat == null || lng == null) return;
		placeMarker(L, map, lat, lng);
		map.setView([lat, lng], Math.max(map.getZoom(), 13));
	}, [lat, lng]);

	async function doSearch(e: React.FormEvent) {
		e.preventDefault();
		const q = search.trim();
		if (!q || searching) return;
		setSearching(true);
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
				{headers: {Accept: 'application/json'}}
			);
			const data = await res.json();
			if (data && data[0]) {
				const la = round6(parseFloat(data[0].lat));
				const lo = round6(parseFloat(data[0].lon));
				const map = mapRef.current;
				const L = (window as any).L;
				if (map && L) {
					map.setView([la, lo], 15);
					placeMarker(L, map, la, lo);
				}
				onChangeRef.current(la, lo);
			}
		} catch {
			/* ignore search failures */
		} finally {
			setSearching(false);
		}
	}

	return (
		<div className={b('map-wrap')}>
			<form className={b('map-search')} onSubmit={doSearch}>
				<MagnifyingGlass size={16} />
				<input
					className={b('map-search-input')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('map_search_placeholder')}
				/>
				<button type="submit" className={b('map-search-btn')} disabled={searching}>
					{searching ? '…' : t('map_search_btn')}
				</button>
			</form>
			<div ref={containerRef} className={b('map-picker')} />
		</div>
	);
}
