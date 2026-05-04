import React, {useState, useEffect} from 'react';
import { useTranslation } from 'react-i18next';
import {gql} from '@apollo/client';
import {IModalProps} from '../../common/modal/Modal';
import {gqlMutate, gqlQuery} from '../../api';
import {useMe} from '../../../util/hooks/useMe';
import Button from '../../common/button/Button';
import {toastError, toastSuccess} from '../../../util/toast';
import {Eye, EyeSlash, ShareNetwork} from 'phosphor-react';
import block from '../../../styles/bem';
import './PublishWcaRecords.scss';
import {generateCuberCardDataUrl, shareOrDownloadCuberCard} from '../../../util/cuber_card';

const b = block('publish-wca-records');

interface WcaRecord {
	id: string;
	wca_event: string;
	single_record?: number;
	average_record?: number;
	single_world_rank?: number;
	average_world_rank?: number;
	single_country_rank?: number;
	average_country_rank?: number;
	published: boolean;
}

interface VisibilityState {
	showCompetitions: boolean;
	showMedals: boolean;
	showRecords: boolean;
	showRank: boolean;
	showResults: boolean;
}

export default function PublishWcaRecords(props: IModalProps) {
	const { t } = useTranslation();
	const {onComplete} = props;
	const me = useMe();

	const [records, setRecords] = useState<WcaRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [fetching, setFetching] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [generatingCard, setGeneratingCard] = useState(false);
	const [integrationCardData, setIntegrationCardData] = useState<any>(null);
	const [visibility, setVisibility] = useState<VisibilityState>({
		showCompetitions: true,
		showMedals: true,
		showRecords: true,
		showRank: true,
		showResults: true,
	});

	useEffect(() => {
		loadWcaRecords();
		loadVisibilitySettings();
	}, []);

	async function loadWcaRecords() {
		setLoading(true);
		try {
			const query = gql`
				query MyWcaRecords {
					myWcaRecords {
						id
						wca_event
						single_record
						average_record
						single_world_rank
						average_world_rank
						single_country_rank
						average_country_rank
						published
					}
				}
			`;

			const res = await gqlQuery(query);
			setRecords((res.data as any).myWcaRecords || []);
		} catch (error) {
			toastError(error.message);
		} finally {
			setLoading(false);
		}
	}

	async function loadVisibilitySettings() {
		try {
			const query = gql`
				query Integration($integrationType: IntegrationType!) {
					integration(integrationType: $integrationType) {
						wca_show_competitions
						wca_show_medals
						wca_show_records
						wca_show_rank
						wca_show_results
						wca_id
						wca_name
						wca_avatar_url
						wca_country_iso2
						wca_competition_count
						wca_medal_gold
						wca_medal_silver
						wca_medal_bronze
					}
				}
			`;
			const res = await gqlQuery(query, { integrationType: 'wca' });
			const int = (res.data as any).integration;
			if (int) {
				setVisibility({
					showCompetitions: int.wca_show_competitions !== false,
					showMedals: int.wca_show_medals !== false,
					showRecords: int.wca_show_records !== false,
					showRank: int.wca_show_rank !== false,
					showResults: int.wca_show_results !== false,
				});
				setIntegrationCardData(int);
			}
		} catch (error) {
			// Defaults are true
		}
	}

	async function handleCreateCuberCard() {
		if (generatingCard) return;
		setGeneratingCard(true);
		try {
			const fullName = me ? `${me.first_name || ''} ${me.last_name || ''}`.trim() : '';
			const username = me?.username || integrationCardData?.wca_name || 'Cuber';

			const dataUrl = await generateCuberCardDataUrl({
				username,
				fullName: fullName || integrationCardData?.wca_name || username,
				avatarUrl: integrationCardData?.wca_avatar_url || null,
				countryIso2: integrationCardData?.wca_country_iso2 || null,
				wcaId: integrationCardData?.wca_id || null,
				competitionCount: integrationCardData?.wca_competition_count ?? null,
				goldMedals: integrationCardData?.wca_medal_gold ?? null,
				silverMedals: integrationCardData?.wca_medal_silver ?? null,
				bronzeMedals: integrationCardData?.wca_medal_bronze ?? null,
				records: records
					.filter((r) => r.single_record || r.average_record)
					.map((r) => ({
						event: getEventName(r.wca_event),
						single: r.single_record,
						average: r.average_record,
					})),
			});

			const filename = `${username.replace(/[^a-z0-9-_]/gi, '_')}-cuber-card.png`;
			await shareOrDownloadCuberCard(dataUrl, filename);
			toastSuccess(t('profile.cuber_card_ready'));
		} catch (error: any) {
			toastError(error?.message || t('profile.cuber_card_failed'));
		} finally {
			setGeneratingCard(false);
		}
	}

	async function fetchWcaData() {
		if (fetching) return;

		setFetching(true);
		try {
			const mutation = gql`
				mutation FetchWcaRecords {
					fetchWcaRecords {
						id
						wca_event
						single_record
						average_record
						single_world_rank
						average_world_rank
						single_country_rank
						average_country_rank
						published
					}
				}
			`;

			const res = await gqlMutate(mutation);
			setRecords((res.data as any).fetchWcaRecords || []);
			toastSuccess(t('profile.wca_data_updated'));
		} catch (error) {
			toastError(error.message);
		} finally {
			setFetching(false);
		}
	}

	async function toggleRecordPublication(record: WcaRecord) {
		setPublishing(true);
		try {
			const mutation = record.published
				? gql`
					mutation UnpublishWcaRecord($recordId: String!) {
						unpublishWcaRecord(recordId: $recordId) { id published }
					}
				`
				: gql`
					mutation PublishWcaRecord($recordId: String!) {
						publishWcaRecord(recordId: $recordId) { id published }
					}
				`;

			await gqlMutate(mutation, { recordId: record.id });
			setRecords(prev => prev.map(r =>
				r.id === record.id ? { ...r, published: !r.published } : r
			));
			toastSuccess(record.published ? t('profile.record_hidden') : t('profile.record_published'));
		} catch (error) {
			toastError(error.message);
		} finally {
			setPublishing(false);
		}
	}

	async function toggleVisibility(field: keyof VisibilityState) {
		const newValue = !visibility[field];
		setVisibility(prev => ({ ...prev, [field]: newValue }));

		try {
			const mutation = gql`
				mutation UpdateWcaVisibility(
					$showCompetitions: Boolean, $showMedals: Boolean,
					$showRecords: Boolean, $showRank: Boolean, $showResults: Boolean
				) {
					updateWcaVisibility(
						showCompetitions: $showCompetitions, showMedals: $showMedals,
						showRecords: $showRecords, showRank: $showRank, showResults: $showResults
					) { id }
				}
			`;

			await gqlMutate(mutation, { [field]: newValue });
		} catch (error) {
			setVisibility(prev => ({ ...prev, [field]: !newValue }));
			toastError(error.message);
		}
	}

	function formatTime(centiseconds: number): string {
		if (!centiseconds) return '—';
		const minutes = Math.floor(centiseconds / 6000);
		const seconds = Math.floor((centiseconds % 6000) / 100);
		const cs = centiseconds % 100;
		if (minutes > 0) {
			return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
		}
		return `${seconds}.${cs.toString().padStart(2, '0')}`;
	}

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	if (loading) {
		return <div className={b('loading')}>{t('profile.wca_records_loading')}</div>;
	}

	const toggleItems: { key: keyof VisibilityState; label: string }[] = [
		{ key: 'showCompetitions', label: t('profile.wca_toggle_competitions') },
		{ key: 'showMedals', label: t('profile.wca_toggle_medals') },
		{ key: 'showRecords', label: t('profile.wca_toggle_records') },
		{ key: 'showRank', label: t('profile.wca_toggle_rank') },
		{ key: 'showResults', label: t('profile.wca_toggle_results') },
	];

	const cards = records.map(record => (
		<div key={record.id} className={b('card', { published: record.published })}>
			<div className={b('card-event')}>{getEventName(record.wca_event)}</div>
			<div className={b('card-records')}>
				<div className={b('card-stat')}>
					<span className={b('card-stat-label')}>{t('profile.single_pb')}</span>
					<span className={b('card-stat-value')}>{record.single_record ? formatTime(record.single_record) : '—'}</span>
				</div>
				<div className={b('card-stat')}>
					<span className={b('card-stat-label')}>{t('profile.average_pb')}</span>
					<span className={b('card-stat-value')}>{record.average_record ? formatTime(record.average_record) : '—'}</span>
				</div>
			</div>
			<div className={b('card-action')}>
				<Button
					text={record.published ? t('profile.hide') : t('profile.publish')}
					small
					primary={!record.published}
					loading={publishing}
					onClick={() => toggleRecordPublication(record)}
					icon={record.published ? <EyeSlash weight="bold" /> : <Eye weight="bold" />}
				/>
			</div>
		</div>
	));

	return (
		<div className={b()}>
			{/* Gorunurluk ayarlari */}
			<div className={b('visibility')}>
				<h4>{t('profile.wca_visibility_title')}</h4>
				<div className={b('toggle-list')}>
					{toggleItems.map(item => (
						<div key={item.key} className={b('toggle-item')} onClick={() => toggleVisibility(item.key)}>
							<span>{item.label}</span>
							<div className={b('toggle', { active: visibility[item.key] })}>
								<div className={b('toggle-knob')} />
							</div>
						</div>
					))}
				</div>
				<button
					type="button"
					className={b('cuber-card-btn')}
					onClick={handleCreateCuberCard}
					disabled={generatingCard}
				>
					<ShareNetwork weight="bold" />
					<span>{generatingCard ? t('profile.cuber_card_generating') : t('profile.create_cuber_card')}</span>
				</button>
			</div>

			{/* Rekor listesi */}
			{records.length > 0 && (
				<>
					<h4>{t('profile.your_wca_official_records')}</h4>
					<div className={b('list')}>
						{cards}
					</div>
				</>
			)}

			{!records.length && (
				<div className={b('empty')}>
					<p>{t('profile.no_wca_records_yet')}</p>
				</div>
			)}

			<div className={b('footer')}>
				<button
					type="button"
					className={b('refresh-btn')}
					onClick={fetchWcaData}
					disabled={fetching}
				>
					{fetching ? '...' : t('profile.update_wca_data')}
				</button>
				<p className={b('info')}>
					{t('profile.wca_records_info')}
				</p>
				<div className={b('actions')}>
					<Button
						primary
						text={t('profile.ok')}
						onClick={onComplete}
					/>
				</div>
			</div>
		</div>
	);
}
