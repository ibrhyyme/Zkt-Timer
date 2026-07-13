import React, {useEffect, useMemo, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {ArrowLeft, Trash, Plus, Bell} from 'phosphor-react';
import {WCA_EVENT_IDS, WCA_CONTINENTS, WCA_COUNTRIES, COUNTRY_TO_CONTINENT} from '../../../../shared/wca_geo';
import {Consts} from '../../../../shared/consts';
import {useMe} from '../../../util/hooks/useMe';
import {isPro} from '../../../lib/pro';
import {openProOnlyModal} from '../../common/pro_only/openProOnlyModal';
import {toastError, toastSuccess} from '../../../util/toast';
import {b, EventIcon, getEventShortName, countryFlag} from './shared';
import {
	RecordWatchEntry,
	fetchRecordWatches,
	saveRecordWatch,
	setRecordWatchEnabled,
	deleteRecordWatch,
	sendTestRecordNotification,
} from './recordWatchApi';
import RecentRecordsFeed from './RecentRecordsFeed';

type Scope = 'WR' | 'CR' | 'NR';
type Tab = 'recent' | 'watches';

function useMyWcaCountry(): string {
	const me = useMe();
	return useMemo(() => {
		const wca = me?.integrations?.find((i: any) => i.service_name === 'wca');
		return (wca?.wca_country_iso2 || '').toUpperCase();
	}, [me]);
}

export default function RecordRadar() {
	const {t, i18n} = useTranslation();
	const dispatch = useDispatch();
	const history = useHistory();
	const me = useMe();
	const myCountry = useMyWcaCountry();

	const [tab, setTab] = useState<Tab>('recent');
	const [watches, setWatches] = useState<RecordWatchEntry[] | null>(null);
	const [saving, setSaving] = useState(false);

	// New-watch builder state
	const [events, setEvents] = useState<Set<string>>(new Set());
	const [scope, setScope] = useState<Scope>('WR');
	const [region, setRegion] = useState<string>('');

	useEffect(() => {
		if (!me) {
			setWatches([]);
			return;
		}
		let mounted = true;
		fetchRecordWatches()
			.then((w) => mounted && setWatches(w))
			.catch(() => mounted && setWatches([]));
		return () => {
			mounted = false;
		};
	}, [me]);

	// When scope changes, seed a sensible default region.
	function onScopeChange(next: Scope) {
		setScope(next);
		if (next === 'WR') {
			setRegion('');
		} else if (next === 'NR') {
			setRegion(myCountry && COUNTRY_TO_CONTINENT[myCountry] ? myCountry : '');
		} else if (next === 'CR') {
			const myContinent = myCountry ? COUNTRY_TO_CONTINENT[myCountry] : '';
			setRegion(myContinent || WCA_CONTINENTS[0].id);
		}
	}

	function toggleEvent(code: string) {
		setEvents((prev) => {
			const next = new Set(prev);
			next.has(code) ? next.delete(code) : next.add(code);
			return next;
		});
	}

	async function handleSave() {
		if (saving) return;

		if (!me) {
			toastError(t('my_schedule.radar_login_required'));
			return;
		}
		// Free user → Pro upsell
		if (!isPro(me)) {
			openProOnlyModal(dispatch, t, 'competition_watch');
			return;
		}
		if (events.size === 0) {
			toastError(t('my_schedule.radar_no_events'));
			return;
		}
		if ((scope === 'CR' || scope === 'NR') && !region) {
			toastError(t('my_schedule.radar_no_region'));
			return;
		}
		if ((watches?.length || 0) >= Consts.MAX_RECORD_WATCHES) {
			toastError(t('my_schedule.radar_limit_reached', {max: Consts.MAX_RECORD_WATCHES}));
			return;
		}

		setSaving(true);
		try {
			const created = await saveRecordWatch({
				events: Array.from(events),
				scope,
				region: scope === 'WR' ? undefined : region,
			});
			setWatches((prev) => [...(prev || []), created]);
			setEvents(new Set());
			setScope('WR');
			setRegion('');
			toastSuccess(t('my_schedule.radar_saved'));
		} catch (err: any) {
			toastError(err?.message || t('my_schedule.radar_save_error'));
		} finally {
			setSaving(false);
		}
	}

	async function handleSendTest() {
		try {
			await sendTestRecordNotification(i18n.language);
			toastSuccess(t('my_schedule.radar_test_sent'));
		} catch (err: any) {
			toastError(err?.message || t('my_schedule.radar_save_error'));
		}
	}

	async function handleToggle(w: RecordWatchEntry) {
		const nextEnabled = !w.enabled;
		setWatches((prev) => prev?.map((x) => (x.id === w.id ? {...x, enabled: nextEnabled} : x)) || null);
		try {
			await setRecordWatchEnabled(w.id, nextEnabled);
		} catch {
			// revert on failure
			setWatches((prev) => prev?.map((x) => (x.id === w.id ? {...x, enabled: w.enabled} : x)) || null);
			toastError(t('my_schedule.radar_save_error'));
		}
	}

	async function handleDelete(w: RecordWatchEntry) {
		setWatches((prev) => prev?.filter((x) => x.id !== w.id) || null);
		try {
			await deleteRecordWatch(w.id);
		} catch {
			toastError(t('my_schedule.radar_save_error'));
			// reload authoritative state
			fetchRecordWatches().then(setWatches).catch(() => {});
		}
	}

	function scopeRegionLabel(w: RecordWatchEntry): React.ReactNode {
		if (w.scope === 'WR') return t('my_schedule.radar_scope_wr');
		if (w.scope === 'CR') {
			const c = WCA_CONTINENTS.find((x) => x.id === w.region);
			return `${t('my_schedule.radar_scope_cr')} · ${c?.name || w.region}`;
		}
		// NR
		const country = WCA_COUNTRIES.find((x) => x.iso2 === w.region);
		return (
			<>
				{t('my_schedule.radar_scope_nr')} · {countryFlag(w.region)} {country?.name || w.region}
			</>
		);
	}

	const notPro = me && !isPro(me);

	return (
		<div className={b('content')}>
				<button className={b('back')} onClick={() => history.push('/competitions')}>
					<ArrowLeft size={18} />
					{t('my_schedule.back_to_list')}
				</button>

				<h1 className={b('radar-title')}>
					<Bell size={22} weight="fill" style={{marginRight: 8, color: 'rgb(var(--primary-color))'}} />
					{t('my_schedule.radar_title')}
				</h1>

				<div className={b('radar-tabs')}>
					<button
						className={b('radar-tab', {active: tab === 'recent'})}
						onClick={() => setTab('recent')}
					>
						{t('my_schedule.tab_recent')}
					</button>
					<button
						className={b('radar-tab', {active: tab === 'watches'})}
						onClick={() => setTab('watches')}
					>
						{t('my_schedule.tab_watches')}
					</button>
				</div>

				{me?.admin && (
					<button className={b('radar-test-btn')} onClick={handleSendTest}>
						<Bell size={14} weight="fill" />
						{t('my_schedule.radar_test_send')}
					</button>
				)}

				{tab === 'recent' && <RecentRecordsFeed />}

				{tab === 'watches' && (
				<>
				<p className={b('radar-desc')}>{t('my_schedule.radar_desc')}</p>

				{notPro && (
					<div className={b('radar-pro-banner')} onClick={() => openProOnlyModal(dispatch, t, 'competition_watch')}>
						{t('my_schedule.radar_pro_hint')}
					</div>
				)}

				{/* Builder */}
				<div className={b('radar-builder')}>
					<span className={b('radar-builder-label')}>{t('my_schedule.radar_select_events')}</span>
					<div className={b('event-filter-chips')}>
						{WCA_EVENT_IDS.map((code) => (
							<button
								key={code}
								className={b('event-chip', {active: events.has(code)})}
								onClick={() => toggleEvent(code)}
								title={getEventShortName(code)}
								aria-pressed={events.has(code)}
							>
								<EventIcon eventId={code} size={16} />
							</button>
						))}
					</div>

					<span className={b('radar-builder-label')}>{t('my_schedule.radar_select_scope')}</span>
					<div className={b('radar-scope-seg')}>
						{(['WR', 'CR', 'NR'] as Scope[]).map((s) => (
							<button
								key={s}
								className={b('radar-scope-btn', {active: scope === s})}
								onClick={() => onScopeChange(s)}
							>
								{t(`my_schedule.radar_scope_${s.toLowerCase()}`)}
							</button>
						))}
					</div>

					{scope === 'CR' && (
						<select
							className={b('radar-region-select')}
							value={region}
							onChange={(e) => setRegion(e.target.value)}
						>
							{WCA_CONTINENTS.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					)}

					{scope === 'NR' && (
						<select
							className={b('radar-region-select')}
							value={region}
							onChange={(e) => setRegion(e.target.value)}
						>
							<option value="">{t('my_schedule.radar_select_country')}</option>
							{WCA_COUNTRIES.map((c) => (
								<option key={c.iso2} value={c.iso2}>
									{c.name}
								</option>
							))}
						</select>
					)}

					<button className={b('radar-save-btn')} onClick={handleSave} disabled={saving}>
						<Plus size={16} weight="bold" />
						{t('my_schedule.radar_add')}
					</button>
				</div>

				{/* Existing watches */}
				<h3 className={b('section-title')}>{t('my_schedule.radar_my_watches')}</h3>
				{watches === null ? (
					<p className={b('my-competitions-empty')}>{t('my_schedule.loading')}</p>
				) : watches.length === 0 ? (
					<p className={b('empty')}>{t('my_schedule.radar_empty')}</p>
				) : (
					<div className={b('radar-list')}>
						{watches.map((w) => (
							<div key={w.id} className={b('radar-item', {disabled: !w.enabled})}>
								<div className={b('radar-item-main')}>
									<div className={b('radar-item-events')}>
										{w.events.map((ev) => (
											<EventIcon key={ev} eventId={ev} size={16} />
										))}
									</div>
									<span className={b('radar-item-scope')}>{scopeRegionLabel(w)}</span>
								</div>
								<div className={b('radar-item-actions')}>
									<label className={b('radar-toggle')}>
										<input
											type="checkbox"
											checked={w.enabled}
											onChange={() => handleToggle(w)}
										/>
										<span className={b('radar-toggle-track')} />
									</label>
									<button
										className={b('radar-item-delete')}
										onClick={() => handleDelete(w)}
										aria-label={t('my_schedule.radar_delete')}
										title={t('my_schedule.radar_delete')}
									>
										<Trash size={16} />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
				</>
				)}
			</div>
	);
}
