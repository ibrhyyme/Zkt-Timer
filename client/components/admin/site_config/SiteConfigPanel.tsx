import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {Warning, Wrench, Database, CaretDown, CaretUp} from 'phosphor-react';
import {useQuery} from '@apollo/client';
import {gqlMutate, gqlMutateTyped, gqlQueryTyped} from '../../api';
import {
	UpdateSiteConfigDocument,
	SiteConfigDocument,
	OnlineStatsDocument,
	OnlineStatsQuery,
	OnlineUsersDocument,
	OnlineUsersQuery,
} from '../../../@types/generated/graphql';
import gql from 'graphql-tag';
import {setSiteConfigCache, SiteConfigData} from '../../../util/hooks/useSiteConfig';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import FeatureAccessControl from './FeatureAccessControl';
import block from '../../../styles/bem';
import './SiteConfigPanel.scss';

const b = block('site-config-panel');

const BACKFILL_WCA_IDS = gql`mutation { backfillWcaIds { total filled tokenFailed noWcaId error recordsTotal recordsFilled recordsError } }`;
const TEST_WCA_NOTIFICATION = gql`mutation TestWcaNotification($wcaId: String!) { testWcaNotification(wcaId: $wcaId) }`;
const MY_PUSH_TOKENS = gql`query { adminMyPushTokens { platform } }`;

type FeatureKey = 'maintenance_mode' | 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled' | 'pro_enabled';

const PAGE_TOGGLES: {key: FeatureKey; label: string; description: string}[] = [
	{key: 'trainer_enabled', label: 'Trainer', description: 'Algoritma trainer sayfasi'},
	{key: 'community_enabled', label: 'Yarismalar', description: 'WCA yarismalar sayfasi + WCA Live'},
	{key: 'rooms_enabled', label: 'Rooms', description: 'Multiplayer rooms sayfasi'},
	{key: 'battle_enabled', label: 'Battle', description: '1v1 battle modu (mobile)'},
	{key: 'leaderboards_enabled', label: 'Siralama', description: 'Kinch Ranks + Sum of Ranks siralama sayfasi'},
	{key: 'pro_enabled', label: 'Pro Uyelik', description: 'Pro abonelik satis sayfasi + paywall. Banka/odeme hazir degilse kapali tut.'},
];

export default function SiteConfigPanel() {
	const {t} = useTranslation();
	const [config, setConfig] = useState<SiteConfigData | null>(null);
	const [saving, setSaving] = useState<FeatureKey | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [backfillLoading, setBackfillLoading] = useState(false);
	const [backfillResult, setBackfillResult] = useState<string | null>(null);

	const [wcaIdInput, setWcaIdInput] = useState('');
	const [testPushLoading, setTestPushLoading] = useState(false);
	const [testPushResult, setTestPushResult] = useState<string | null>(null);

	const [tokenCheckLoading, setTokenCheckLoading] = useState(false);
	const [tokenCheckResult, setTokenCheckResult] = useState<string | null>(null);

	// Canli online sayaci — 10 saniyede bir polling
	const {data: onlineData} = useQuery<OnlineStatsQuery>(OnlineStatsDocument, {
		pollInterval: 10000,
		fetchPolicy: 'no-cache',
	});

	// Online kullanici listesi — sadece expand acikken polling
	const [showOnlineList, setShowOnlineList] = useState(false);
	const {data: onlineUsersData, error: onlineUsersError} = useQuery<OnlineUsersQuery>(OnlineUsersDocument, {
		pollInterval: showOnlineList ? 10000 : 0,
		fetchPolicy: 'no-cache',
		skip: !showOnlineList,
	});

	useEffect(() => {
		if (onlineUsersError) {
			console.warn('[SiteConfigPanel] onlineUsers query error:', onlineUsersError);
		}
	}, [onlineUsersError]);

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

			{/* Canli Aktivite */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<h3>Canli Aktivite</h3>
				</div>
				<div className={b('live')}>
					<div className={b('live-main')}>
						<span className={b('live-dot')} />
						<span className={b('live-number')}>{onlineData?.onlineStats?.uniqueUsers ?? '—'}</span>
						<span className={b('live-label')}>online kullanici</span>
					</div>
					<div className={b('live-meta')}>
						<span className={b('live-meta-item')}>
							{onlineData?.onlineStats?.anonymous ?? 0} anonim ziyaretci
						</span>
						<span className={b('live-meta-item')}>
							{onlineData?.onlineStats?.totalSockets ?? 0} toplam baglanti
						</span>
					</div>
				</div>

				{(onlineData?.onlineStats?.uniqueUsers ?? 0) > 0 && (
					<button
						className={b('list-toggle')}
						onClick={() => setShowOnlineList((v) => !v)}
					>
						{showOnlineList ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
						<span>{showOnlineList ? 'Listeyi gizle' : 'Kimler online?'}</span>
					</button>
				)}

				{showOnlineList && (
					<div className={b('online-list')}>
						{onlineUsersError ? (
							<div className={b('online-list-empty')} style={{color: '#ef5350'}}>
								Liste yuklenemedi: {onlineUsersError.message}
							</div>
						) : !onlineUsersData ? (
							<div className={b('online-list-empty')}>Yukleniyor...</div>
						) : onlineUsersData.onlineUsers.length === 0 ? (
							<div className={b('online-list-empty')}>Giris yapmis kullanici yok.</div>
						) : (
							onlineUsersData.onlineUsers
								.slice()
								.sort((a, b) => b.tabCount - a.tabCount)
								.map(({user, tabCount}) => (
									<Link key={user.id} to={`/user/${user.username}`} className={b('online-item')}>
										<AvatarImage user={user} small />
										<div className={b('online-item-text')}>
											<div className={b('online-item-name')}>
												{user.username}
												{user.admin && <span className={b('online-badge', {admin: true})}>admin</span>}
												{!user.admin && user.mod && <span className={b('online-badge', {mod: true})}>mod</span>}
												{user.is_premium && <span className={b('online-badge', {premium: true})}>premium</span>}
												{!user.is_premium && user.is_pro && <span className={b('online-badge', {pro: true})}>pro</span>}
												{user.verified && <span className={b('online-badge', {verified: true})}>verified</span>}
											</div>
											{tabCount > 1 && (
												<div className={b('online-item-meta')}>{tabCount} tab acik</div>
											)}
										</div>
									</Link>
								))
						)}
					</div>
				)}
			</div>

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
					const override = config.featureOverrides?.find((o: any) => o.feature === key) ?? null;
					return (
						<div key={key} className={b('feature-block')}>
							<div className={b('row')}>
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
							<FeatureAccessControl
								feature={key}
								currentOverride={override}
								onSaved={(updated) => {
									setSiteConfigCache(updated);
									setConfig(updated);
								}}
							/>
						</div>
					);
				})}
			</div>

			{/* WCA Backfill */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>WCA Veri Onarimi</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>WCA ID Backfill</div>
						<div className={b('row-desc')}>
							WCA hesabi bagli ama WCA ID'si eksik kullanicilarin verilerini WCA API'den cekip rankings'i hesaplar.
						</div>
					</div>
					<button
						className={b('action-btn')}
						disabled={backfillLoading}
						onClick={async () => {
							setBackfillLoading(true);
							setBackfillResult(null);
							try {
								const res = await gqlMutate(BACKFILL_WCA_IDS);
								const r = res?.data?.backfillWcaIds;
								if (r) {
									const parts = [`WCA ID: ${r.filled}/${r.total} dolduruldu`];
									if (r.tokenFailed > 0) parts.push(`${r.tokenFailed} token gecersiz`);
									if (r.noWcaId > 0) parts.push(`${r.noWcaId} WCA ID alinamadi`);
									if (r.error > 0) parts.push(`${r.error} hata`);
									parts.push(`Ranking: ${r.recordsFilled}/${r.recordsTotal} hesaplandi`);
									if (r.recordsError > 0) parts.push(`${r.recordsError} ranking hatasi`);
									setBackfillResult(parts.join(' | '));
								} else {
									setBackfillResult('Sonuc alinamadi');
								}
							} catch (err) {
								setBackfillResult('Hata: ' + (err as any)?.message);
							} finally {
								setBackfillLoading(false);
							}
						}}
					>
						{backfillLoading ? 'Calisiyor...' : 'Calistir'}
					</button>
				</div>
				{backfillResult && (
					<div className={b('row')}>
						<div className={b('row-text')}>
							<div className={b('row-desc')}>{backfillResult}</div>
						</div>
					</div>
				)}
			</div>

			{/* WCA Bildirim Testi */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>WCA Bildirim Testi</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Test Push Gönder</div>
						<div className={b('row-desc')}>
							WCA ID'ye sahip kullanıcıya örnek sonuç ve tur bildirimleri gönderir (sahte veri, gerçek yarışma gerekmez).
						</div>
					</div>
					<div className={b('test-push-controls')}>
						<input
							className={b('test-push-input')}
							value={wcaIdInput}
							onChange={(e) => setWcaIdInput(e.target.value.toUpperCase())}
							placeholder="WCA ID"
							maxLength={10}
						/>
						<button
							className={b('action-btn')}
							disabled={testPushLoading || !wcaIdInput.trim()}
							onClick={async () => {
								setTestPushLoading(true);
								setTestPushResult(null);
								try {
									await gqlMutate(TEST_WCA_NOTIFICATION, {wcaId: wcaIdInput.trim()});
									setTestPushResult('Bildirimler gönderildi.');
								} catch (err) {
									setTestPushResult('Hata: ' + (err as any)?.message);
								} finally {
									setTestPushLoading(false);
								}
							}}
						>
							{testPushLoading ? 'Gönderiliyor...' : 'Gönder'}
						</button>
					</div>
				</div>
				{testPushResult && (
					<div className={b('row')}>
						<div className={b('row-text')}>
							<div className={b('row-desc')}>{testPushResult}</div>
						</div>
					</div>
				)}
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Kayıtlı Token'larım</div>
						<div className={b('row-desc')}>
							Hangi platformlarda push token'ı DB'de kayıtlı? iOS yok → register() başarısız.
						</div>
					</div>
					<button
						className={b('action-btn')}
						disabled={tokenCheckLoading}
						onClick={async () => {
							setTokenCheckLoading(true);
							setTokenCheckResult(null);
							try {
								const res = await gqlQueryTyped(MY_PUSH_TOKENS, {}, {fetchPolicy: 'no-cache'});
								const tokens: {platform: string}[] = res?.data?.adminMyPushTokens ?? [];
								if (tokens.length === 0) {
									setTokenCheckResult('Hiç token yok — register() hiç çalışmamış.');
								} else {
									setTokenCheckResult(tokens.map((t) => t.platform).join(', '));
								}
							} catch (err) {
								setTokenCheckResult('Hata: ' + (err as any)?.message);
							} finally {
								setTokenCheckLoading(false);
							}
						}}
					>
						{tokenCheckLoading ? 'Kontrol ediliyor...' : 'Kontrol Et'}
					</button>
				</div>
				{tokenCheckResult && (
					<div className={b('row')}>
						<div className={b('row-text')}>
							<div className={b('row-desc')}>{tokenCheckResult}</div>
						</div>
					</div>
				)}
			</div>

			<div className={b('footer')}>
				Son guncelleme: {formatTime(config.updated_at)}
			</div>
		</div>
	);
}
