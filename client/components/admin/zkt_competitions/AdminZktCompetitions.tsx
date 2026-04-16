import React, {useEffect, useState, useCallback} from 'react';
import './AdminZktCompetitions.scss';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Plus, Trash, PencilSimple} from 'phosphor-react';
import {openModal} from '../../../actions/general';
import {toastSuccess, toastError} from '../../../util/toast';
import Loading from '../../common/loading/Loading';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import CreateZktCompetitionModal from './CreateZktCompetitionModal';
import {b, formatDateRange, getEventName} from './shared';
import {useHistory} from 'react-router-dom';

const LIST_QUERY = gql`
	query ZktCompsForAdmin($page: Int!, $pageSize: Int!, $searchQuery: String!, $filter: ZktCompetitionFilterInput) {
		zktCompetitionsForAdmin(page: $page, pageSize: $pageSize, searchQuery: $searchQuery, filter: $filter) {
			items {
				id
				name
				date_start
				date_end
				location
				status
				visibility
				competitor_limit
				events {
					id
					event_id
				}
			}
			total
			hasMore
		}
	}
`;

const DELETE_MUTATION = gql`
	mutation DeleteZktComp($id: String!) {
		deleteZktCompetition(id: $id)
	}
`;

interface CompItem {
	id: string;
	name: string;
	date_start: string;
	date_end: string;
	location: string;
	status: string;
	visibility: string;
	competitor_limit?: number;
	events: Array<{id: string; event_id: string}>;
}

export default function AdminZktCompetitions() {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const dispatch = useDispatch();
	const history = useHistory();
	const [items, setItems] = useState<CompItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('');

	const fetchList = useCallback(async () => {
		setLoading(true);
		try {
			const filter: any = {};
			if (statusFilter) filter.status = statusFilter;
			const result = await gqlMutate(LIST_QUERY, {
				page: 0,
				pageSize: 50,
				searchQuery: search,
				filter,
			});
			setItems(result?.data?.zktCompetitionsForAdmin?.items || []);
		} catch {
			toastError('Yarismalar yuklenemedi');
		} finally {
			setLoading(false);
		}
	}, [search, statusFilter]);

	useEffect(() => {
		fetchList();
	}, [fetchList]);

	function openCreate() {
		dispatch(
			openModal(
				<CreateZktCompetitionModal onComplete={fetchList} />
			)
		);
	}

	function handleDelete(comp: CompItem) {
		dispatch(
			openModal(
				<ConfirmModal
					buttonText={t('delete_confirm_button')}
					hideInput
					triggerAction={async () => {
						try {
							await gqlMutate(DELETE_MUTATION, {id: comp.id});
							toastSuccess(t('deleted'));
							fetchList();
						} catch (e: any) {
							toastError(e?.message || t('error'));
						}
					}}
				/>
			)
		);
	}

	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	return (
		<div className={b()}>
			<div className={b('toolbar')}>
				<input
					className={b('search')}
					placeholder={t('search_placeholder')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<select
					className={b('select')}
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
				>
					<option value="">{t('filter_all_status')}</option>
					<option value="DRAFT">{t('status_draft')}</option>
					<option value="ANNOUNCED">{t('status_announced')}</option>
					<option value="REGISTRATION_OPEN">{t('status_registration_open')}</option>
					<option value="REGISTRATION_CLOSED">{t('status_registration_closed')}</option>
					<option value="ONGOING">{t('status_ongoing')}</option>
					<option value="FINISHED">{t('status_finished')}</option>
					<option value="PUBLISHED">{t('status_published')}</option>
				</select>
				<button className={b('create-btn')} onClick={openCreate}>
					<Plus weight="bold" /> {t('create_competition')}
				</button>
			</div>

			{loading ? (
				<Loading />
			) : items.length === 0 ? (
				<div className={b('empty')}>{t('no_competitions')}</div>
			) : (
				<div className={b('list')}>
					{items.map((comp) => (
						<div key={comp.id} className={b('card')}>
							<div className={b('card-main')}>
								<div className={b('card-title')}>{comp.name}</div>
								<div className={b('card-meta')}>
									{formatDateRange(comp.date_start, comp.date_end, locale)} - {comp.location}
								</div>
								<div className={b('card-events')}>
									{comp.events.map((e) => (
										<span key={e.id} className={b('event-chip')} title={getEventName(e.event_id)}>
											<span className={`cubing-icon event-${e.event_id}`} />
										</span>
									))}
								</div>
							</div>
							<div className={b('card-side')}>
								<span className={b('status', {[comp.status.toLowerCase()]: true})}>
									{t(`status_${comp.status.toLowerCase()}`)}
								</span>
								<span className={b('visibility', {[comp.visibility.toLowerCase()]: true})}>
									{t(`visibility_${comp.visibility.toLowerCase()}`)}
								</span>
							</div>
							<div className={b('card-actions')}>
								<button
									className={b('action-btn')}
									onClick={() => history.push(`/admin/competitions/${comp.id}`)}
								>
									<PencilSimple weight="bold" /> {t('manage')}
								</button>
								<button
									className={b('action-btn', {danger: true})}
									onClick={() => handleDelete(comp)}
									title={t('delete')}
								>
									<Trash weight="bold" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
