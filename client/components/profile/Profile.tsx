import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import './Profile.scss';
import { CircleWavyCheck, Plus, YoutubeLogo, TwitchLogo } from 'phosphor-react';
import { gql } from '@apollo/client';
import { gqlMutate, gqlQuery } from '../api';
import { PROFILE_FRAGMENT } from '../../util/graphql/fragments';
import PbCard from './pb_card/PbCard';
import PFP from './pfp/PFP';
import UploadCover from '../common/upload_cover/UploadCover';
import About from './about/About';
import { setSsrValue } from '../../actions/ssr';
import Header from '../layout/header/Header';
import WCA from './wca/WCA';
import Avatar from '../common/avatar/Avatar';
import { getStorageURL, resourceUri } from '../../util/storage';
import { Image, Profile as ProfileSchema, PublicUserAccount, TopAverage, TopSolve } from '../../@types/generated/graphql';
import { useRouteMatch } from 'react-router-dom';
import { useSsr } from '../../util/hooks/useSsr';
import block from '../../styles/bem';
import { useMe } from '../../util/hooks/useMe';
import { useGeneral } from '../../util/hooks/useGeneral';
import { getMe } from '../../actions/account';
import AvatarDropdown from '../common/avatar/avatar_dropdown/AvatarDropdown';
import { openModal } from '../../actions/general';
import PublishSolves from './publish_solves/PublishSolves';
import PublishWcaRecords from './publish_wca_records/PublishWcaRecords';
import WcaPbCard from './wca_pb_card/WcaPbCard';
import Button from '../common/button/Button';
import LoadingIcon from '../common/LoadingIcon';
import MobileNav from '../layout/nav/mobile_nav/MobileNav';
import WcaSummary from './wca_summary/WcaSummary';
import WcaResults from './wca_results/WcaResults';

const b = block('profile');

interface IProfileData {
	user: PublicUserAccount;
	profile: ProfileSchema;
	pfpImage?: Image;
	headerImage?: Image;
	pbs: {
		[key: string]: {
			single?: TopSolve;
			average?: TopAverage;
		};
	};
}

export async function getProfileData(username: string): Promise<IProfileData> {
	const query = gql`
		${PROFILE_FRAGMENT}
		query Query($username: String) {
			profile(username: $username) {
				...ProfileFragment
			}
		}
	`;

	const result = await gqlQuery<{ profile: ProfileSchema }>(query, {
		username,
	} as any);

	const topSolves = result.data.profile.top_solves;
	const topAverages = result.data.profile.top_averages;

	const pbs = {};

	for (const topSolve of topSolves) {
		const solve = topSolve.solve;
		const cubeType = solve.cube_type;
		if (!pbs[cubeType]) {
			pbs[cubeType] = {};
		}
		pbs[cubeType].single = topSolve;
	}

	for (const topAverage of topAverages) {
		if (pbs[topAverage.cube_type]) {
			pbs[topAverage.cube_type].average = topAverage;
		}
	}

	return {
		user: result.data.profile.user,
		profile: result.data.profile,
		pfpImage: result.data.profile.pfp_image,
		headerImage: result.data.profile.header_image,
		pbs,
	};
}

export async function prefetchProfileData(store, req) {
	const profileData = await getProfileData(req.params.username);
	return store.dispatch(setSsrValue(req.params.username, profileData));
}

// Social icon helper
function SocialIcons({ profile }: { profile: ProfileSchema }) {
	const links: { key: string; icon: React.ReactNode; href: string }[] = [];

	if (profile.youtube_link) {
		links.push({
			key: 'youtube',
			icon: <YoutubeLogo weight="fill" />,
			href: profile.youtube_link,
		});
	}
	if (profile.twitch_link) {
		links.push({
			key: 'twitch',
			icon: <TwitchLogo weight="fill" />,
			href: profile.twitch_link,
		});
	}
	if (profile.twitter_link) {
		links.push({
			key: 'twitter',
			icon: (
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
				</svg>
			),
			href: profile.twitter_link,
		});
	}
	if (profile.reddit_link) {
		links.push({
			key: 'wca',
			icon: (
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					style={{ width: '14px', height: '14px' }}
				/>
			),
			href: profile.reddit_link,
		});
	}

	if (!links.length) return null;

	return (
		<div className={b('social-icons')}>
			{links.map((link) => (
				<a
					key={link.key}
					className={b('social-icon')}
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
				>
					{link.icon}
				</a>
			))}
		</div>
	);
}

export default function Profile() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const match = useRouteMatch() as any;

	const matchUsername = match?.params?.username;

	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');
	const settingsModalOpen = useGeneral('settings_modal_open');
	const [ssrProfile, setSsrProfile] = useSsr<IProfileData>(matchUsername);
	const [loading, setLoading] = useState(!ssrProfile);
	const [profileData, setProfileData] = useState<IProfileData>(ssrProfile);
	const [recordsTab, setRecordsTab] = useState<'pb' | 'wca' | 'results'>('pb');
	const [wcaRecords, setWcaRecords] = useState([]);
	const [wcaIntegration, setWcaIntegration] = useState<any>(null);
	const [wcaResultsData, setWcaResultsData] = useState<any[]>(null);
	const [fabOpen, setFabOpen] = useState(false);

	const username = matchUsername;
	const user = profileData?.user;
	const profile = profileData?.profile;
	const headerImage = profileData?.headerImage;
	const pbs = profileData?.pbs;

	useEffect(() => {
		if (profileData && profileData?.user?.username === matchUsername) {
			return null;
		}

		if (!loading) {
			setLoading(true);
		}

		getProfileData(matchUsername).then((data) => {
			setProfileData(data);
			setSsrProfile(data);
			setLoading(false);
		});
	}, [matchUsername]);

	useEffect(() => {
		if (user?.id) {
			loadWcaRecords();
		}
	}, [user?.id]);

	async function loadWcaRecords() {
		try {
			const query = gql`
				query WcaRecords($userId: String) {
					wcaRecords(userId: $userId) {
						id
						wca_event
						single_record
						average_record
						single_world_rank
						average_world_rank
						single_country_rank
						average_country_rank
						published
						integration {
							wca_id
							wca_country_iso2
							wca_competition_count
							wca_medal_gold
							wca_medal_silver
							wca_medal_bronze
							wca_record_nr
							wca_record_cr
							wca_record_wr
							wca_show_competitions
							wca_show_medals
							wca_show_records
							wca_show_rank
							wca_show_results
						}
					}
				}
			`;

			const res = await gqlQuery(query, { userId: user?.id });
			const records = (res.data as any).wcaRecords || [];
			setWcaRecords(records);

			// PB yoksa ve WCA kaydi varsa varsayilan tab'i degistir
			if (Object.keys(pbs || {}).length === 0 && records.length > 0) {
				setRecordsTab('wca');
			}

			// Integration metadata'yi ilk record'dan al
			if (records.length > 0 && records[0].integration) {
				const int = records[0].integration;
				setWcaIntegration(int);

				// WCA results verisini de burada cek (tab degisiminde remount olmasin)
				if (int.wca_id && int.wca_show_results !== false) {
					loadWcaResultsData(int.wca_id);
				}

				// PB ve WCA kaydi yoksa ama results varsa
				if (Object.keys(pbs || {}).length === 0 && records.length === 0 && int.wca_id && int.wca_show_results !== false) {
					setRecordsTab('results');
				}
			}
		} catch (error) {
			console.error('Failed to load WCA records:', error);
			setWcaRecords([]);
		}
	}

	async function loadWcaResultsData(wcaId: string) {
		try {
			const resultsQuery = gql`
				query WcaResults($wcaId: String!) {
					wcaResults(wcaId: $wcaId) {
						competition_id
						competition_name
						competition_date
						event_id
						round_type_id
						pos
						best
						average
						attempts
						regional_single_record
						regional_average_record
					}
				}
			`;
			const res = await gqlQuery(resultsQuery, { wcaId });
			setWcaResultsData((res.data as any).wcaResults || []);
		} catch (error) {
			console.error('Failed to load WCA results:', error);
			setWcaResultsData([]);
		}
	}

	async function uploadProfileHeader(variables) {
		const query = gql`
			mutation Mutate($file: Upload) {
				uploadProfileHeader(file: $file) {
					id
					storage_path
				}
			}
		`;

		const res = await gqlMutate<{ uploadProfileHeader: Image }>(query, variables);
		const storagePath = res.data.uploadProfileHeader.storage_path;

		const newProfileData = { ...profileData };
		newProfileData.headerImage = res.data.uploadProfileHeader;
		setProfileData(newProfileData);

		dispatch(getMe());

		return {
			storagePath,
		};
	}

	function openPublishSolves() {
		dispatch(
			openModal(<PublishSolves />, {
				title: t('profile.publish_pbs'),
				description: t('profile.publish_pbs_desc'),
				closeButtonText: t('solve_info.done'),
				onComplete: () => window.location.reload(),
			})
		);
	}

	function openPublishWcaRecords() {
		dispatch(
			openModal(<PublishWcaRecords />, {
				title: t('profile.wca_manage_data'),
				description: t('profile.wca_manage_data_desc'),
				hideCloseButton: true,
				onComplete: () => window.location.reload(),
			})
		);
	}

	let headerUrl = getStorageURL('storage/default_profile_background.jpeg');
	if (headerImage) {
		headerUrl = getStorageURL(headerImage.storage_path);
	}

	if (loading) {
		return (
			<div className={b({ loading })}>
				<LoadingIcon />
			</div>
		);
	}

	const topCubeTypes = Object.keys(pbs);

	const pbCards = [];
	for (const ct of topCubeTypes) {
		let solves = [];
		const pb = pbs[ct];

		let topRecord = null;
		if (pb?.single) {
			solves = [pb.single.solve];
			topRecord = pb.single;
		} else if (pb.average) {
			const avg = pb.average;
			solves = [avg.solve_1, avg.solve_2, avg.solve_3, avg.solve_4, avg.solve_5];
			topRecord = pb.average;
		}

		pbCards.push(<PbCard key={pb.single?.id || pb.average?.id || ct} solves={solves} topRecord={topRecord} user={user} />);
	}

	const myProfile = user.id === me?.id;

	const wcaCards = wcaRecords.map((record: any) => (
		<WcaPbCard key={record.id} record={record} />
	));

	// Stats bar data
	const pbCount = topCubeTypes.length;
	const wcaCount = wcaRecords.length;

	// En iyi world rank hesapla
	let bestWorldRank: number | undefined;
	let bestWorldRankEvent: string | undefined;
	for (const rec of wcaRecords as any[]) {
		if (rec.single_world_rank && (!bestWorldRank || rec.single_world_rank < bestWorldRank)) {
			bestWorldRank = rec.single_world_rank;
			bestWorldRankEvent = rec.wca_event;
		}
		if (rec.average_world_rank && (!bestWorldRank || rec.average_world_rank < bestWorldRank)) {
			bestWorldRank = rec.average_world_rank;
			bestWorldRankEvent = rec.wca_event;
		}
	}

	// Varsayilan tab: PB yoksa WCA'ya, WCA da yoksa results'a gec
	const hasResults = wcaIntegration?.wca_id && wcaIntegration.wca_show_results !== false;
	const showTabs = pbCards.length > 0 || wcaCards.length > 0 || hasResults;

	let recordsSection = null;
	if (showTabs) {
		recordsSection = (
			<div className={b('records')}>
				<div className={b('records-tabs')}>
					{pbCards.length > 0 && (
						<button
							className={b('tab', { active: recordsTab === 'pb' })}
							onClick={() => setRecordsTab('pb')}
						>
							{t(mobileMode ? 'profile.personal_records_short' : 'profile.personal_records')}
							<span className={b('tab-count')}>{pbCards.length}</span>
						</button>
					)}
					{wcaCards.length > 0 && (
						<button
							className={b('tab', { active: recordsTab === 'wca' })}
							onClick={() => setRecordsTab('wca')}
						>
							<img
								src={resourceUri('/images/logos/wca_logo.svg')}
								alt="WCA"
								className={b('tab-wca-logo')}
							/>
							{t(mobileMode ? 'profile.wca_official_records_short' : 'profile.wca_official_records')}
							<span className={b('tab-count')}>{wcaCards.length}</span>
						</button>
					)}
					{hasResults && (
						<button
							className={b('tab', { active: recordsTab === 'results' })}
							onClick={() => setRecordsTab('results')}
						>
							{t(mobileMode ? 'profile.wca_results_tab_short' : 'profile.wca_results_tab')}
						</button>
					)}
				</div>
				<div className={b('records-content')}>
					{recordsTab === 'pb' && (
						<div className={b('pbs')}>{pbCards}</div>
					)}
					{recordsTab === 'wca' && (
						<div className={b('pbs')}>{wcaCards}</div>
					)}
					{recordsTab === 'results' && wcaIntegration?.wca_id && (
						<WcaResults wcaId={wcaIntegration.wca_id} data={wcaResultsData} />
					)}
				</div>
			</div>
		);
	}

	// Desktop publish buttons
	let desktopPublishButtons = null;
	if (myProfile && !mobileMode) {
		desktopPublishButtons = (
			<div className={b('publish-buttons')}>
				<Button
					primary
					icon={<Plus weight="bold" />}
					text={t('profile.publish_pbs')}
					onClick={openPublishSolves}
					small
				/>
				<Button
					primary
					icon={<Plus weight="bold" />}
					text={t('profile.wca_manage_data')}
					onClick={openPublishWcaRecords}
					small
				/>
			</div>
		);
	}

	// Mobile FAB
	let fab = null;
	if (myProfile && mobileMode) {
		fab = (
			<div className={b('fab-wrapper')}>
				{fabOpen && (
					<div className={b('fab-menu')}>
						<button className={b('fab-item')} onClick={() => { openPublishSolves(); setFabOpen(false); }}>
							{t('profile.publish_pbs')}
						</button>
						<button className={b('fab-item')} onClick={() => { openPublishWcaRecords(); setFabOpen(false); }}>
							{t('profile.wca_manage_data')}
						</button>
					</div>
				)}
				<button
					className={b('fab', { open: fabOpen })}
					onClick={() => setFabOpen(!fabOpen)}
				>
					<Plus weight="bold" />
				</button>
			</div>
		);
	}

	return (
		<div className={b('wrapper', { standalone: !me, mobile: mobileMode, blurred: settingsModalOpen })}>
			<Header
				path={`/user/${username}`}
				title={user.username + ' Profile | Zkt Timer'}
				description={`Check out ${user.username}'s Zkt Timer profile to see their fastest speedcubing times. See their WCA profile, cubing bio, social links, and more`}
			/>
			<div className={b({ me: myProfile })}>
				{/* Banner — sadece kapak resmi varsa ve desktop'taysa goster */}
				{headerImage && !mobileMode && (
					<div className={b('banner')}>
						{myProfile && <UploadCover upload={uploadProfileHeader} />}
						<img src={headerUrl} alt="" />
						<div className={b('banner-gradient')} />
					</div>
				)}

				{/* Identity Block — banner yoksa centered layout */}
				{headerImage && !mobileMode ? (
					<div className={b('identity')}>
						<div className={b('identity-pfp')}>
							<PFP profile={profile} allowChange={myProfile} />
						</div>
						<div className={b('identity-info')}>
							<div className={b('identity-top')}>
								<div className={b('identity-name')}>
									<h2>
										{user.username}
										{user.verified && <CircleWavyCheck weight="fill" />}
									</h2>
									{(user as any).admin && <span className={b('role-badge', { admin: true })}>Admin</span>}
									{(user as any).mod && !(user as any).admin && <span className={b('role-badge', { mod: true })}>Mod</span>}
								</div>
								<div className={b('identity-actions')}>
									<WCA myProfile={myProfile} user={user} />
									<AvatarDropdown user={user as any} />
								</div>
							</div>
							<SocialIcons profile={profile} />
						</div>
					</div>
				) : (
					<>
						{/* Mobilde AvatarDropdown sayfanin sag ustunde */}
						{mobileMode && (
							<div className={b('corner-dropdown')}>
								<AvatarDropdown user={user as any} />
							</div>
						)}
						<div className={b('identity', { centered: true })}>
							<div className={b('identity-pfp')}>
								<PFP profile={profile} allowChange={myProfile} />
							</div>
							<div className={b('identity-name', { spaced: true })}>
								<h2>
									{user.username}
									{user.verified && <CircleWavyCheck weight="fill" />}
								</h2>
								{(user as any).admin && <span className={b('role-badge', { admin: true })}>Admin</span>}
								{(user as any).mod && !(user as any).admin && <span className={b('role-badge', { mod: true })}>Mod</span>}
							</div>
							<SocialIcons profile={profile} />
							<div className={b('identity-actions', { centered: true })}>
								<WCA myProfile={myProfile} user={user} />
								{mobileMode && <MobileNav />}
								{!mobileMode && <AvatarDropdown user={user as any} />}
							</div>
						</div>
					</>
				)}

				{/* Content */}
				<div className={b('content')}>
					{/* Desktop publish buttons */}
					{desktopPublishButtons}

					{/* Bio Card — en ustte, bossa gizle */}
					{profile.bio && <About profile={profile} />}

					{/* WCA Summary Card */}
					{wcaIntegration && (
						<WcaSummary
							integration={wcaIntegration}
							bestWorldRank={bestWorldRank}
							bestWorldRankEvent={bestWorldRankEvent}
						/>
					)}

					{/* Stats Bar */}
					<div className={b('stats-bar', { mobile: mobileMode })}>
						<div className={b('stat-item')}>
							<span className={b('stat-value')}>{pbCount}</span>
							<span className={b('stat-label')}>PBs</span>
						</div>
						<div className={b('stat-item')}>
							<span className={b('stat-value')}>{wcaCount}</span>
							<span className={b('stat-label')}>WCA</span>
						</div>
						<div className={b('stat-item')}>
							<span className={b('stat-value')}>{profile.three_method || '-'}</span>
							<span className={b('stat-label')}>{t('profile.method_3x3')}</span>
						</div>
						<div className={b('stat-item')}>
							<span className={b('stat-value')}>{profile.three_goal || '-'}</span>
							<span className={b('stat-label')}>{t('profile.goal_3x3')}</span>
						</div>
					</div>

					{/* Records */}
					{recordsSection}
				</div>
			</div>

			{/* Mobile FAB */}
			{fab}
		</div>
	);
}
