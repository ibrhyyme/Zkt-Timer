import React, {useState, useEffect} from 'react';
import { useTranslation } from 'react-i18next';
import {gql} from '@apollo/client';
import {IModalProps} from '../../common/modal/Modal';
import {gqlMutate, gqlQuery} from '../../api';
import {useMe} from '../../../util/hooks/useMe';
import Button from '../../common/button/Button';
import {toastError, toastSuccess} from '../../../util/toast';
import {Plus} from 'phosphor-react';
import block from '../../../styles/bem';
import './PublishWcaRecords.scss';

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

export default function PublishWcaRecords(props: IModalProps) {
	const { t } = useTranslation();
	const {onComplete} = props;
	const me = useMe();

	const [records, setRecords] = useState<WcaRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [fetching, setFetching] = useState(false);
	const [publishing, setPublishing] = useState(false);

	useEffect(() => {
		loadWcaRecords();
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

	async function fetchWcaRecords() {
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
			toastSuccess(t('profile.wca_records_updated'));
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
						unpublishWcaRecord(recordId: $recordId) {
							id
							published
						}
					}
				`
				: gql`
					mutation PublishWcaRecord($recordId: String!) {
						publishWcaRecord(recordId: $recordId) {
							id
							published
						}
					}
				`;

			await gqlMutate(mutation, { recordId: record.id });

			setRecords(prev => prev.map(r =>
				r.id === record.id
					? { ...r, published: !r.published }
					: r
			));

			toastSuccess(record.published ? t('profile.record_hidden') : t('profile.record_published'));
		} catch (error) {
			toastError(error.message);
		} finally {
			setPublishing(false);
		}
	}

	function formatTime(centiseconds: number): string {
		if (!centiseconds) return '—';

		const minutes = Math.floor(centiseconds / 6000);
		const seconds = Math.floor((centiseconds % 6000) / 100);
		const cs = centiseconds % 100;

		if (minutes > 0) {
			return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
		} else {
			return `${seconds}.${cs.toString().padStart(2, '0')}`;
		}
	}

	function getEventName(eventCode: string): string {
		const key = `wca_events.${eventCode}`;
		const translated = t(key);
		return translated !== key ? translated : eventCode;
	}

	if (loading) {
		return <div className={b('loading')}>{t('profile.wca_records_loading')}</div>;
	}

	if (!records.length) {
		return (
			<div className={b('empty')}>
				<p>{t('profile.no_wca_records_yet')}</p>
				<Button
					primary
					text={t('profile.fetch_wca_records')}
					loading={fetching}
					onClick={fetchWcaRecords}
				/>
			</div>
		);
	}

	const cards = records.map(record => (
		<div key={record.id} className={b('card', { published: record.published })}>
			<div className={b('card-event')}>{getEventName(record.wca_event)}</div>
			<div className={b('card-records')}>
				<div className={b('card-stat')}>
					<span className={b('card-stat-label')}>{t('profile.single_pb')}</span>
					<span className={b('card-stat-value')}>{record.single_record ? formatTime(record.single_record) : '—'}</span>
					{record.single_country_rank && (
						<span className={b('card-rank')}>#{record.single_country_rank} {t('profile.country_short', { defaultValue: 'TR' })}</span>
					)}
				</div>
				<div className={b('card-stat')}>
					<span className={b('card-stat-label')}>{t('profile.average_pb')}</span>
					<span className={b('card-stat-value')}>{record.average_record ? formatTime(record.average_record) : '—'}</span>
					{record.average_country_rank && (
						<span className={b('card-rank')}>#{record.average_country_rank} {t('profile.country_short', { defaultValue: 'TR' })}</span>
					)}
				</div>
			</div>
			<div className={b('card-action')}>
				<Button
					text={record.published ? t('profile.hide') : t('profile.publish')}
					small
					primary={!record.published}
					loading={publishing}
					onClick={() => toggleRecordPublication(record)}
					icon={record.published ? undefined : <Plus weight="bold" />}
				/>
			</div>
		</div>
	));

	return (
		<div className={b()}>
			<div className={b('list')}>
				{cards}
			</div>

			<div className={b('footer')}>
				<button
					type="button"
					className={b('refresh-btn')}
					onClick={fetchWcaRecords}
					disabled={fetching}
				>
					{fetching ? '...' : t('profile.update_records')}
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
