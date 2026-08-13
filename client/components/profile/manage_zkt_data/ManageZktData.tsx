import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {IModalProps} from '../../common/modal/Modal';
import {gqlMutate, gqlQuery} from '../../api';
import Button from '../../common/button/Button';
import {toastError} from '../../../util/toast';
import block from '../../../styles/bem';
import '../publish_wca_records/PublishWcaRecords.scss';

// Deliberately reuses PublishWcaRecords' stylesheet and block name: this is the
// same panel for the other federation, and a second visual language for the
// same job would only make the pair look unrelated.
const b = block('publish-wca-records');

interface VisibilityState {
	showCompetitions: boolean;
	showMedals: boolean;
	showRecords: boolean;
	showPbs: boolean;
}

interface ZktProfile {
	zkt_id?: string;
	zkt_member_no?: number;
	zkt_competition_count?: number;
	zkt_medal_gold?: number;
	zkt_medal_silver?: number;
	zkt_medal_bronze?: number;
	zkt_record_count?: number;
	zkt_personal_bests?: {event_id: string; single?: string; average?: string}[];
	zkt_show_competitions?: boolean;
	zkt_show_medals?: boolean;
	zkt_show_records?: boolean;
	zkt_show_pbs?: boolean;
}

const MY_ZKT_PROFILE_QUERY = gql`
	query MyZktProfile {
		myZktProfile {
			zkt_id
			zkt_member_no
			zkt_competition_count
			zkt_medal_gold
			zkt_medal_silver
			zkt_medal_bronze
			zkt_record_count
			zkt_personal_bests {
				event_id
				single
				average
			}
			zkt_show_competitions
			zkt_show_medals
			zkt_show_records
			zkt_show_pbs
		}
	}
`;

const UPDATE_ZKT_VISIBILITY = gql`
	mutation UpdateZktVisibility(
		$showCompetitions: Boolean
		$showMedals: Boolean
		$showRecords: Boolean
		$showPbs: Boolean
	) {
		updateZktVisibility(
			showCompetitions: $showCompetitions
			showMedals: $showMedals
			showRecords: $showRecords
			showPbs: $showPbs
		) {
			id
		}
	}
`;

export default function ManageZktData(props: IModalProps) {
	const {t} = useTranslation();
	const {onComplete} = props;

	const [profile, setProfile] = useState<ZktProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [visibility, setVisibility] = useState<VisibilityState>({
		showCompetitions: true,
		showMedals: true,
		showRecords: true,
		showPbs: true,
	});

	useEffect(() => {
		loadProfile();
	}, []);

	async function loadProfile() {
		setLoading(true);
		try {
			const res = await gqlQuery(MY_ZKT_PROFILE_QUERY);
			const data = (res.data as any)?.myZktProfile as ZktProfile | null;
			setProfile(data);
			if (data) {
				setVisibility({
					showCompetitions: data.zkt_show_competitions !== false,
					showMedals: data.zkt_show_medals !== false,
					showRecords: data.zkt_show_records !== false,
					showPbs: data.zkt_show_pbs !== false,
				});
			}
		} catch (error) {
			toastError(error.message);
		} finally {
			setLoading(false);
		}
	}

	async function toggleVisibility(field: keyof VisibilityState) {
		const newValue = !visibility[field];
		setVisibility((prev) => ({...prev, [field]: newValue}));

		try {
			await gqlMutate(UPDATE_ZKT_VISIBILITY, {[field]: newValue});
		} catch (error) {
			setVisibility((prev) => ({...prev, [field]: !newValue}));
			toastError(error.message);
		}
	}

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	if (loading) {
		return <div className={b('loading')}>{t('profile.zkt_loading')}</div>;
	}

	// No linked account at all: the panel has nothing to manage, and saying so is
	// more useful than an empty list of switches.
	if (!profile) {
		return (
			<div className={b()}>
				<div className={b('empty')}>
					<p>{t('profile.zkt_not_linked')}</p>
					<a href="/account/linked-accounts">{t('profile.zkt_link_account')}</a>
				</div>
			</div>
		);
	}

	const toggleItems: {key: keyof VisibilityState; label: string}[] = [
		{key: 'showCompetitions', label: t('profile.zkt_toggle_competitions')},
		{key: 'showMedals', label: t('profile.zkt_toggle_medals')},
		{key: 'showRecords', label: t('profile.zkt_toggle_records')},
		{key: 'showPbs', label: t('profile.zkt_toggle_pbs')},
	];

	const pbs = profile.zkt_personal_bests || [];

	return (
		<div className={b()}>
			<div className={b('visibility')}>
				<h4>{t('profile.zkt_visibility_title')}</h4>
				<div className={b('toggle-list')}>
					{toggleItems.map((item) => (
						<div
							key={item.key}
							className={b('toggle-item')}
							onClick={() => toggleVisibility(item.key)}
						>
							<span>{item.label}</span>
							<div className={b('toggle', {active: visibility[item.key]})}>
								<div className={b('toggle-knob')} />
							</div>
						</div>
					))}
				</div>
			</div>

			{/* A member without a ZKT ID has not competed yet — the federation issues
			    it with their first published result, so there are no numbers to show. */}
			{!profile.zkt_id ? (
				<div className={b('empty')}>
					<p>{t('profile.zkt_no_results_yet')}</p>
				</div>
			) : (
				<>
					<h4>{t('profile.zkt_your_data')}</h4>
					<div className={b('list')}>
						<div className={b('card', {published: true})}>
							<div className={b('card-event')}>{profile.zkt_id}</div>
							<div className={b('card-records')}>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>{t('profile.zkt_competitions')}</span>
									<span className={b('card-stat-value')}>
										{profile.zkt_competition_count ?? 0}
									</span>
								</div>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>{t('profile.zkt_medals')}</span>
									<span className={b('card-stat-value')}>
										{(profile.zkt_medal_gold || 0)}/{profile.zkt_medal_silver || 0}/
										{profile.zkt_medal_bronze || 0}
									</span>
								</div>
								<div className={b('card-stat')}>
									<span className={b('card-stat-label')}>{t('profile.zkt_records')}</span>
									<span className={b('card-stat-value')}>{profile.zkt_record_count ?? 0}</span>
								</div>
							</div>
						</div>

						{pbs.map((pb) => (
							<div key={pb.event_id} className={b('card', {published: true})}>
								<div className={b('card-event')}>{getEventName(pb.event_id)}</div>
								<div className={b('card-records')}>
									<div className={b('card-stat')}>
										<span className={b('card-stat-label')}>{t('profile.single_pb')}</span>
										<span className={b('card-stat-value')}>{pb.single || '—'}</span>
									</div>
									<div className={b('card-stat')}>
										<span className={b('card-stat-label')}>{t('profile.average_pb')}</span>
										<span className={b('card-stat-value')}>{pb.average || '—'}</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			<div className={b('footer')}>
				<p className={b('info')}>{t('profile.zkt_data_info')}</p>
				<div className={b('actions')}>
					<Button primary text={t('profile.ok')} onClick={onComplete} />
				</div>
			</div>
		</div>
	);
}
