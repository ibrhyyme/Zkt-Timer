import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {Warning, Wrench, Database, CaretDown, CaretUp} from 'phosphor-react';
import {useQuery} from '@apollo/client';
import {gqlMutate, gqlMutateTyped, gqlQueryTyped} from '../../api';
import {toastError} from '../../../util/toast';
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

const BACKFILL_WCA_IDS = gql`mutation { backfillWcaIds { total filled tokenFailed revoked noWcaId rateLimited error recordsTotal recordsFilled recordsError } }`;
const REINDEX_METHOD_STEPS = gql`mutation { reindexSmartCubeMethodSteps { totalCandidates processed filled skippedNoTurns downgraded error } }`;
const REINDEX_LL_CASE_KEYS = gql`mutation { reindexLLCaseKeys { total scanned ollUpdated pllUpdated failed } }`;
const WCA_STATS = gql`query { wcaStats { totalUsers wcaConnected wcaWithId wcaWithoutId wcaWithoutUserId wcaRevoked wcaBackfillPending } }`;
const TEST_WCA_NOTIFICATION = gql`mutation TestWcaNotification($wcaId: String!) { testWcaNotification(wcaId: $wcaId) }`;
const MY_PUSH_TOKENS = gql`query { adminMyPushTokens { platform } }`;

type FeatureKey = 'maintenance_mode' | 'trainer_enabled' | 'community_enabled' | 'leaderboards_enabled' | 'rooms_enabled' | 'battle_enabled' | 'pro_enabled' | 'wca_backfill_enabled';

const PAGE_TOGGLES: {key: FeatureKey; label: string; description: string}[] = [
	{key: 'trainer_enabled', label: 'Trainer', description: 'Algorithm trainer page'},
	{key: 'community_enabled', label: 'Competitions', description: 'WCA competitions page + WCA Live'},
	{key: 'rooms_enabled', label: 'Rooms', description: 'Multiplayer rooms page'},
	{key: 'battle_enabled', label: 'Battle', description: '1v1 battle mode (mobile)'},
	{key: 'leaderboards_enabled', label: 'Rankings', description: 'Kinch Ranks + Sum of Ranks leaderboard page'},
	{key: 'pro_enabled', label: 'Pro Membership', description: 'Pro subscription sales page + paywall. Keep off if payment not ready.'},
];

export default function SiteConfigPanel() {
	const {t} = useTranslation();
	const [config, setConfig] = useState<SiteConfigData | null>(null);
	const [saving, setSaving] = useState<FeatureKey | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [backfillLoading, setBackfillLoading] = useState(false);
	const [backfillResult, setBackfillResult] = useState<string | null>(null);

	const [reindexLoading, setReindexLoading] = useState(false);
	const [reindexResult, setReindexResult] = useState<string | null>(null);

	const [reindexLLLoading, setReindexLLLoading] = useState(false);
	const [reindexLLResult, setReindexLLResult] = useState<string | null>(null);

	const [wcaIdInput, setWcaIdInput] = useState('');
	const [testPushLoading, setTestPushLoading] = useState(false);
	const [testPushResult, setTestPushResult] = useState<string | null>(null);

	const [tokenCheckLoading, setTokenCheckLoading] = useState(false);
	const [tokenCheckResult, setTokenCheckResult] = useState<string | null>(null);

	const {data: wcaStatsData, refetch: refetchWcaStats, loading: wcaStatsLoading} = useQuery<{wcaStats: {totalUsers: number; wcaConnected: number; wcaWithId: number; wcaWithoutId: number; wcaWithoutUserId: number; wcaRevoked: number; wcaBackfillPending: number}}>(WCA_STATS, {fetchPolicy: 'no-cache'});

	// Live online counter — poll every 10 seconds
	const {data: onlineData} = useQuery<OnlineStatsQuery>(OnlineStatsDocument, {
		pollInterval: 10000,
		fetchPolicy: 'no-cache',
	});

	// Online user list — poll only when expanded
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

	// Fetch once on mount (own state, not hook-dependent)
	useEffect(() => {
		gqlQueryTyped(SiteConfigDocument, {}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				const data = res?.data?.siteConfig;
				if (data) {
					setConfig(data as SiteConfigData);
				} else {
					setError('siteConfig query returned empty data');
				}
			})
			.catch((err) => {
				console.error('[SiteConfigPanel] fetch error:', err);
				setError(err?.message || 'Unknown error');
			});
	}, []);

	if (error) {
		return <div className={b('loading')} style={{color: '#f55'}}>Error: {error}</div>;
	}

	if (!config) {
		return <div className={b('loading')}>Loading...</div>;
	}

	async function handleToggle(key: FeatureKey, currentValue: boolean) {
		const newValue = !currentValue;

		// Confirm for maintenance mode
		if (key === 'maintenance_mode' && newValue === true) {
			if (!window.confirm('All users will see maintenance page. Only you (admin) can access. Continue?')) {
				return;
			}
		}

		// Optimistic local update — UI toggles immediately
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
			// Rollback on error
			if (config) {
				setConfig({...config, [key]: currentValue} as SiteConfigData);
			}
			toastError((err as any)?.message ?? 'Error');
		} finally {
			setSaving(null);
		}
	}

	function formatTime(date: Date | string): string {
		const d = new Date(date);
		const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
		if (seconds < 60) return `${seconds} seconds ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes} minutes ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} hours ago`;
		return d.toLocaleString('tr-TR');
	}

	return (
		<div className={b()}>
			<div className={b('header')}>
				<Wrench size={28} weight="fill" />
				<h2>Site Config Panel</h2>
			</div>

			<p className={b('hint')}>
				Toggle changes reflect to all users <strong>within max 60 seconds</strong>. You (admin) are unaffected by any closures.
			</p>

			{/* Live Activity */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<h3>Live Activity</h3>
				</div>
				<div className={b('live')}>
					<div className={b('live-main')}>
						<span className={b('live-dot')} />
						<span className={b('live-number')}>{onlineData?.onlineStats?.uniqueUsers ?? '—'}</span>
						<span className={b('live-label')}>online users</span>
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
							<div className={b('online-list-empty')}>Loading...</div>
						) : onlineUsersData.onlineUsers.length === 0 ? (
							<div className={b('online-list-empty')}>No logged-in users.</div>
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

			{/* Maintenance Mode */}
			<div className={b('section', {danger: true})}>
				<div className={b('section-header')}>
					<Warning size={20} weight="fill" />
					<h3>Maintenance Mode</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Full Site Maintenance</div>
						<div className={b('row-desc')}>
							All users see maintenance page. Only admin (you) can access site.
							Login/signup remain open.
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

			{/* Page Toggles */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<h3>Page Access</h3>
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

			{/* WCA Statistics */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>WCA Statistics</h3>
				</div>
				<div className={b('stats-grid')}>
					{[
						{label: 'Total Users', value: wcaStatsData?.wcaStats?.totalUsers},
						{label: 'WCA Linked', value: wcaStatsData?.wcaStats?.wcaConnected},
						{label: 'With WCA ID', value: wcaStatsData?.wcaStats?.wcaWithId},
						{label: 'Without WCA ID', value: wcaStatsData?.wcaStats?.wcaWithoutId},
						{label: 'Without User ID', value: wcaStatsData?.wcaStats?.wcaWithoutUserId},
						{label: 'Revoked', value: wcaStatsData?.wcaStats?.wcaRevoked},
						{label: 'Backfill Pending', value: wcaStatsData?.wcaStats?.wcaBackfillPending},
					].map(({label, value}) => (
						<div key={label} className={b('stat-card')}>
							<div className={b('stat-label')}>{label}</div>
							<div className={b('stat-value')}>{wcaStatsLoading ? '...' : (value ?? '—')}</div>
						</div>
					))}
				</div>
				<div className={b('row')} style={{marginTop: 8}}>
					<div />
					<button className={b('action-btn')} disabled={wcaStatsLoading} onClick={() => refetchWcaStats()}>
						Yenile
					</button>
				</div>
			</div>

			{/* WCA Data Repair */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>WCA Data Repair</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Automatic Backfill Cron</div>
						<div className={b('row-desc')}>
							Every night at LA 03:00 (TR 13:00) scans and auto-fills missing wca_user_id / wca_id records.
							Can disable for WCA API rate-limit or emergency.
						</div>
					</div>
					<button
						className={b('toggle', {on: (config as any).wca_backfill_enabled !== false})}
						onClick={() => handleToggle('wca_backfill_enabled', (config as any).wca_backfill_enabled !== false)}
						disabled={saving === 'wca_backfill_enabled'}
					>
						<span className={b('toggle-track')}>
							<span className={b('toggle-thumb')} />
						</span>
					</button>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Manual Backfill</div>
						<div className={b('row-desc')}>
							Fetches from WCA API and fills users with linked WCA account but missing wca_user_id / wca_id + recalculates rankings.
							Trigger now instead of waiting for cron.
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
									const parts = [`${r.filled + r.noWcaId}/${r.total} islendi`];
									if (r.filled > 0) parts.push(`${r.filled} WCA ID dolduruldu`);
									if (r.noWcaId > 0) parts.push(`${r.noWcaId} newcomer (ID yok, user_id kaydedildi)`);
									if (r.tokenFailed > 0) parts.push(`${r.tokenFailed} token transient`);
									if (r.revoked > 0) parts.push(`${r.revoked} revoked (isaretlendi)`);
									if (r.rateLimited > 0) parts.push(`${r.rateLimited} rate-limit`);
									if (r.error > 0) parts.push(`${r.error} hata`);
									parts.push(`Ranking: ${r.recordsFilled}/${r.recordsTotal} hesaplandi`);
									if (r.recordsError > 0) parts.push(`${r.recordsError} ranking hatasi`);
									setBackfillResult(parts.join(' | '));
								} else {
									setBackfillResult('Sonuc alinamadi');
								}
								refetchWcaStats();
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

			{/* Smart Cube Method Steps Reindex */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>Smart Cube Step Data</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Method Steps Reindex</div>
						<div className={b('row-desc')}>
							Tum is_smart_cube=true solve'lari isler. Step kaydi olanlari SILIP yeniden hesaplar
							(engine algoritmasi degistiginde eski turn_count'lari duzeltir), step kaydi olmayanlari
							olusturur (eski solve'lari doldurur). smart_turns yoksa veya parse edilemez ise
                            is_smart_cube=false olarak downgrade eder. Buyuk DB'lerde dakikalar surebilir, sayfayi kapatma.
						</div>
					</div>
					<button
						className={b('action-btn')}
						disabled={reindexLoading}
						onClick={async () => {
							if (!window.confirm('Bu islem tum is_smart_cube=true solve\'larin step kayitlarini SILIP yeniden olusturur. Devam?')) {
								return;
							}
							setReindexLoading(true);
							setReindexResult(null);
							try {
								const res = await gqlMutate(REINDEX_METHOD_STEPS);
								const r = res?.data?.reindexSmartCubeMethodSteps;
								if (r) {
									const parts = [`${r.processed}/${r.totalCandidates} islendi`];
									if (r.filled > 0) parts.push(`${r.filled} step kaydi yeniden olusturuldu`);
									if (r.skippedNoTurns > 0) parts.push(`${r.skippedNoTurns} smart_turns yok`);
									if (r.downgraded > 0) parts.push(`${r.downgraded} downgrade edildi`);
									if (r.error > 0) parts.push(`${r.error} hata`);
									setReindexResult(parts.join(' | '));
								} else {
									setReindexResult('Sonuc alinamadi');
								}
							} catch (err) {
								setReindexResult('Hata: ' + (err as any)?.message);
							} finally {
								setReindexLoading(false);
							}
						}}
					>
						{reindexLoading ? 'Calisiyor...' : 'Calistir'}
					</button>
				</div>
				{reindexResult && (
					<div className={b('row')}>
						<div className={b('row-text')}>
							<div className={b('row-desc')}>{reindexResult}</div>
						</div>
					</div>
				)}
			</div>

			{/* OLL/PLL Case Keys Reindex */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>OLL/PLL Case Recognition Reindex</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>OLL/PLL Case Keys Backfill</div>
						<div className={b('row-desc')}>
							Re-identifies smart cube solves with NULL case_key using new identification algorithm (cstimer-based pattern matching). DOES NOT DELETE step records — only fills missing OLL/PLL case_keys. Much faster than Method Steps Reindex.
						</div>
					</div>
					<button
						className={b('action-btn')}
						disabled={reindexLLLoading}
						onClick={async () => {
							setReindexLLLoading(true);
							setReindexLLResult(null);
							try {
								const res = await gqlMutate(REINDEX_LL_CASE_KEYS);
								const r = res?.data?.reindexLLCaseKeys;
								if (r) {
									const parts = [`${r.scanned}/${r.total} solve tarandi`];
									if (r.ollUpdated > 0) parts.push(`${r.ollUpdated} OLL guncellendi`);
									if (r.pllUpdated > 0) parts.push(`${r.pllUpdated} PLL guncellendi`);
									if (r.failed > 0) parts.push(`${r.failed} hata`);
									setReindexLLResult(parts.join(' | '));
								} else {
									setReindexLLResult('Sonuc alinamadi');
								}
							} catch (err) {
								setReindexLLResult('Error: ' + (err as any)?.message);
							} finally {
								setReindexLLLoading(false);
							}
						}}
					>
						{reindexLLLoading ? 'Running...' : 'Run'}
					</button>
				</div>
				{reindexLLResult && (
					<div className={b('row')}>
						<div className={b('row-text')}>
							<div className={b('row-desc')}>{reindexLLResult}</div>
						</div>
					</div>
				)}
			</div>

			{/* WCA Notification Test */}
			<div className={b('section')}>
				<div className={b('section-header')}>
					<Database size={20} weight="fill" />
					<h3>WCA Notification Test</h3>
				</div>
				<div className={b('row')}>
					<div className={b('row-text')}>
						<div className={b('row-label')}>Send Test Push</div>
						<div className={b('row-desc')}>
							Sends sample result and round notifications to a user with this WCA ID (fake data, no real competition needed).
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
									setTestPushResult('Notifications sent.');
								} catch (err) {
									setTestPushResult('Hata: ' + (err as any)?.message);
								} finally {
									setTestPushLoading(false);
								}
							}}
						>
							{testPushLoading ? 'Sending...' : 'Send'}
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
						<div className={b('row-label')}>My Registered Tokens</div>
						<div className={b('row-desc')}>
							Which platforms have a push token in DB? No iOS → register() failed.
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
									setTokenCheckResult('No tokens — register() never ran.');
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
						{tokenCheckLoading ? 'Checking...' : 'Check'}
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
				Last updated: {formatTime(config.updated_at)}
			</div>
		</div>
	);
}
