import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Warning, Wrench} from 'phosphor-react';
import {gqlMutateTyped, gqlQueryTyped} from '../../api';
import {UpdateSiteConfigDocument, SiteConfigDocument} from '../../../@types/generated/graphql';
import {setSiteConfigCache, SiteConfigData} from '../../../util/hooks/useSiteConfig';
import block from '../../../styles/bem';
import './SiteConfigPanel.scss';

const b = block('site-config-panel');

type FeatureKey = 'maintenance_mode' | 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled';

const PAGE_TOGGLES: {key: FeatureKey; label: string; description: string}[] = [
	{key: 'trainer_enabled', label: 'Trainer', description: 'Algoritma trainer sayfasi'},
	{key: 'community_enabled', label: 'Yarismalar', description: 'WCA yarismalar sayfasi + WCA Live'},
	{key: 'rooms_enabled', label: 'Rooms', description: 'Multiplayer rooms sayfasi'},
	{key: 'battle_enabled', label: 'Battle', description: '1v1 battle modu (mobile)'},
];

export default function SiteConfigPanel() {
	const {t} = useTranslation();
	const [config, setConfig] = useState<SiteConfigData | null>(null);
	const [saving, setSaving] = useState<FeatureKey | null>(null);

	const [error, setError] = useState<string | null>(null);

	// Mount'ta bir kez fetch et (kendi state'imiz, hook bagimli degil)
	useEffect(() => {
		gqlQueryTyped(SiteConfigDocument, {}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				const data = res?.data?.siteConfig;
				if (data) {
					setConfig(data as SiteConfigData);
				} else {
					setError('siteConfig query bos data dondu');
				}
			})
			.catch((err) => {
				console.error('[SiteConfigPanel] fetch hatasi:', err);
				setError(err?.message || 'Bilinmeyen hata');
			});
	}, []);

	if (error) {
		return <div className={b('loading')} style={{color: '#f55'}}>Hata: {error}</div>;
	}

	if (!config) {
		return <div className={b('loading')}>Yükleniyor...</div>;
	}

	async function handleToggle(key: FeatureKey, currentValue: boolean) {
		const newValue = !currentValue;

		// Bakim modu icin confirm
		if (key === 'maintenance_mode' && newValue === true) {
			if (!window.confirm('Tum kullanicilar bakim sayfasini gorecek. Sadece sen (admin) erisebileceksin. Devam?')) {
				return;
			}
		}

		// Optimistic local update — UI hemen toggle olur
		if (config) {
			setConfig({...config, [key]: newValue} as SiteConfigData);
		}
		setSaving(key);
		try {
			const res = await gqlMutateTyped(UpdateSiteConfigDocument, {
				input: {[key]: newValue},
			});
			const updated = res?.data?.updateSiteConfig;
			if (updated) {
				setSiteConfigCache(updated as SiteConfigData);
				setConfig(updated as SiteConfigData);
			}
		} catch (err) {
			// Hata ise rollback
			if (config) {
				setConfig({...config, [key]: currentValue} as SiteConfigData);
			}
			// eslint-disable-next-line no-alert
			alert('Hata: ' + (err as any)?.message);
		} finally {
			setSaving(null);
		}
	}

	function formatTime(date: Date | string): string {
		const d = new Date(date);
		const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
		if (seconds < 60) return `${seconds} saniye once`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes} dakika once`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} saat once`;
		return d.toLocaleString('tr-TR');
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<Wrench size={28} weight="fill" />
				<h2>Site Yönetim Paneli</h2>
			</div>

			<p className={b('hint')}>
				Toggle degisiklikleri <strong>en fazla 60 saniye icinde</strong> tum kullanicilara yansir. Sen (admin) hicbir kapaliliktan etkilenmezsin.
			</p>

			{/* Bakim Modu */}
			<div className={b('section', {danger: true})}>
				<div className={b('section-header')}>
					<Warning size={20} weight="fill" />
					<h3>Bakim Modu</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Tam Site Bakimi</div>
						<div className={b('row-desc')}>
							Tum kullanicilar bakim sayfasini gorur. Sadece admin (sen) site'a erisebilir.
							Login/signup acik kalir.
						</div>
					</div>
					<button
						className={b('toggle', {on: config.maintenance_mode, danger: true})}
						onClick={() => handleToggle('maintenance_mode', config.maintenance_mode)}
						disabled={saving === 'maintenance_mode'}
					>
						<span className={b('toggle-track')}>
							<span className={b('toggle-thumb')} />
						</span>
					</button>
				</div>
			</div>

			{/* Sayfa Toggles */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<h3>Sayfa Erisimi</h3>
				</div>
				{PAGE_TOGGLES.map(({key, label, description}) => {
					const value = (config as any)[key];
					return (
						<div key={key} className={b('row')}>
							<div className={b('row-text')}>
								<div className={b('row-label')}>{label}</div>
								<div className={b('row-desc')}>{description}</div>
							</div>
							<button
								className={b('toggle', {on: value})}
								onClick={() => handleToggle(key, value)}
								disabled={saving === key}
							>
								<span className={b('toggle-track')}>
									<span className={b('toggle-thumb')} />
								</span>
							</button>
						</div>
					);
				})}
			</div>

			<div className={b('footer')}>
				Son guncelleme: {formatTime(config.updated_at)}
			</div>
		</div>
	);
}
