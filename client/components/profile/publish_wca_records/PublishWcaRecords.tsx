import React, {useState, useEffect} from 'react';
import { useTranslation } from 'react-i18next';
import {gql} from '@apollo/client';
import {IModalProps} from '../../common/modal/Modal';
import {gqlMutate, gqlQuery} from '../../api';
import {useMe} from '../../../util/hooks/useMe';
import Button from '../../common/button/Button';
import {toastError, toastSuccess} from '../../../util/toast';
import Emblem from '../../common/emblem/Emblem';
import {Plus, Check} from 'phosphor-react';
import './PublishWcaRecords.scss';

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
			
			// Update local state
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
		return <div>{t('profile.wca_records_loading')}</div>;
	}

	if (!records.length) {
		return (
			<div className="publish-wca-records">
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

	const rows = records.map(record => (
		<tr key={record.id}>
			<td>
				<Emblem text={getEventName(record.wca_event)} />
			</td>
			<td>
				{record.single_record && (
					<div>
						<Emblem text={formatTime(record.single_record)} />
						{record.single_country_rank && (
							<small>#{record.single_country_rank} Türkiye</small>
						)}
					</div>
				)}
			</td>
			<td>
				{record.average_record && (
					<div>
						<Emblem text={formatTime(record.average_record)} />
						{record.average_country_rank && (
							<small>#{record.average_country_rank} Türkiye</small>
						)}
					</div>
				)}
			</td>
			<td>
				<Button
					text={record.published ? t('profile.hide') : t('profile.publish')}
					small
					primary={!record.published}
					loading={publishing}
					onClick={() => toggleRecordPublication(record)}
					icon={record.published ? undefined : <Plus weight="bold" />}
				/>
			</td>
		</tr>
	));

	return (
		<div className="publish-wca-records">
			<div className="wca-records-header">
				<h3>{t('profile.your_wca_official_records')}</h3>
				<Button
					text={t('profile.update_records')} 
					loading={fetching}
					onClick={fetchWcaRecords}
				/>
			</div>

			<table className="cd-table">
				<thead>
					<tr>
						<th>{t('profile.event')}</th>
						<th>{t('profile.single_pb')}</th>
						<th>{t('profile.average_pb')}</th>
						<th>{t('profile.status')}</th>
					</tr>
				</thead>
				<tbody>{rows}</tbody>
			</table>

			<div className="wca-records-footer">
				<p>
					<small>
						{t('profile.wca_records_info')}
					</small>
				</p>
				<Button
					primary
					text={t('profile.ok')}
					onClick={onComplete}
				/>
			</div>
		</div>
	);
}
