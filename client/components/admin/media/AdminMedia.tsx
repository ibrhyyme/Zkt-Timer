import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {gql, useMutation, useQuery} from '@apollo/client';
import {Trash, X} from 'phosphor-react';
import block from '../../../styles/bem';
import PageTitle from '../../common/page_title/PageTitle';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import Empty from '../../common/empty/Empty';
import Input from '../../common/inputs/input/Input';
import {getStorageURL} from '../../../util/storage';
import {getFullFormattedDate} from '../../../util/dates';
import {toastError, toastSuccess} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import './AdminMedia.scss';

const b = block('admin-media');

const PAGE_SIZE = 24;
// Typing in the search box should not fire a query per keystroke.
const SEARCH_DEBOUNCE_MS = 350;

// type-graphql exposes enums by member NAME, so the wire values are upper case even
// though the server-side enum holds lower case strings.
type Kind = 'PROFILE_PICTURE' | 'PROFILE_HEADER' | 'TIMER_BACKGROUND';

interface MediaAsset {
	id: string;
	kind: Kind;
	storage_path: string;
	created_at: string;
	size_bytes?: number | null;
	user?: {id: string; username: string} | null;
}

const MEDIA_ASSETS = gql`
	query Query($kind: MediaAssetKind, $search: String, $page: Int, $limit: Int) {
		mediaAssets(kind: $kind, search: $search, page: $page, limit: $limit) {
			total
			items {
				id
				kind
				storage_path
				created_at
				size_bytes
				user {
					id
					username
				}
			}
		}
	}
`;

const DELETE_MEDIA_ASSET = gql`
	mutation Mutate($id: String!, $kind: MediaAssetKind!) {
		deleteMediaAsset(id: $id, kind: $kind)
	}
`;

function formatBytes(bytes?: number | null): string | null {
	if (bytes == null) return null;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminMedia() {
	const {t} = useTranslation();
	const [kind, setKind] = useState<Kind | null>(null);
	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(0);
	const [preview, setPreview] = useState<MediaAsset | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [searchInput]);

	// Any filter change invalidates the current page number.
	useEffect(() => {
		setPage(0);
	}, [kind, search]);

	const {data, loading, refetch} = useQuery<{mediaAssets: {items: MediaAsset[]; total: number}}>(MEDIA_ASSETS, {
		variables: {kind, search: search || null, page, limit: PAGE_SIZE},
		fetchPolicy: 'cache-and-network',
	});

	const [deleteAsset] = useMutation(DELETE_MEDIA_ASSET);

	const items = data?.mediaAssets?.items || [];
	const total = data?.mediaAssets?.total || 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const FILTERS: {id: Kind | null; label: string}[] = useMemo(
		() => [
			{id: null, label: t('admin_media.filter_all')},
			{id: 'PROFILE_PICTURE', label: t('admin_media.filter_pfp')},
			{id: 'PROFILE_HEADER', label: t('admin_media.filter_header')},
			{id: 'TIMER_BACKGROUND', label: t('admin_media.filter_background')},
		],
		[t]
	);

	const KIND_LABELS: Record<Kind, string> = {
		PROFILE_PICTURE: t('admin_media.filter_pfp'),
		PROFILE_HEADER: t('admin_media.filter_header'),
		TIMER_BACKGROUND: t('admin_media.filter_background'),
	};

	async function handleDelete(asset: MediaAsset) {
		try {
			await deleteAsset({variables: {id: asset.id, kind: asset.kind}});
			toastSuccess(t('admin_media.deleted'));
			setPreview(null);
			await refetch();
		} catch (e: any) {
			toastError(getGqlErrorMessage(e, t, 'admin_media.delete_failed'));
		}
	}

	return (
		<div className={b()}>
			<PageTitle pageName={t('admin_media.title')} />

			<div className={b('toolbar')}>
				<div className={b('filters')}>
					{FILTERS.map((filter) => (
						<button
							key={filter.id || 'all'}
							type="button"
							className={b('filter', {active: kind === filter.id})}
							onClick={() => setKind(filter.id)}
						>
							{filter.label}
						</button>
					))}
				</div>
				<div className={b('search')}>
					<Input
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder={t('admin_media.search_placeholder')}
						maxWidth
					/>
				</div>
			</div>

			<div className={b('count')}>{t('admin_media.total_count', {count: total})}</div>

			{loading && items.length === 0 ? (
				<div className={b('state')}>
					<Loading />
				</div>
			) : items.length === 0 ? (
				<div className={b('state')}>
					<Empty text={t('admin_media.empty')} />
				</div>
			) : (
				<div className={b('grid')}>
					{items.map((asset) => {
						const url = getStorageURL(asset.storage_path);
						const size = formatBytes(asset.size_bytes);
						// The server reports null size when the row outlived its file, which is
						// more reliable than waiting for the <img> to fail.
						const fileOnDisk = asset.size_bytes != null;
						return (
							<div key={`${asset.kind}-${asset.id}`} className={b('card')}>
								<button
									type="button"
									className={b('thumb')}
									onClick={() => fileOnDisk && setPreview(asset)}
									disabled={!fileOnDisk}
									aria-label={t('admin_media.preview')}
								>
									{url && fileOnDisk ? (
										<img src={url} alt="" loading="lazy" className={b('thumb-image')} />
									) : (
										<span className={b('thumb-missing')}>{t('admin_media.file_missing')}</span>
									)}
								</button>

								<div className={b('meta')}>
									<span className={b('kind')}>{KIND_LABELS[asset.kind]}</span>
									{asset.user?.username ? (
										<Link className={b('user')} to={`/user/${asset.user.username}`}>
											{asset.user.username}
										</Link>
									) : (
										<span className={b('user')}>{t('admin_media.unknown_user')}</span>
									)}
									<span className={b('detail')}>
										{getFullFormattedDate(asset.created_at)}
										{size ? ` · ${size}` : ` · ${t('admin_media.file_missing')}`}
									</span>
								</div>

								<Button
									warning
									small
									icon={<Trash weight="bold" />}
									text={t('admin_media.delete')}
									confirmModalProps={{
										title: t('admin_media.delete_confirm_title'),
										description: t('admin_media.delete_confirm_description', {
											username: asset.user?.username || '',
										}),
										buttonText: t('admin_media.delete'),
										buttonProps: {warning: true},
										hideInput: true,
										triggerAction: () => handleDelete(asset),
									}}
								/>
							</div>
						);
					})}
				</div>
			)}

			{pageCount > 1 && (
				<div className={b('pagination')}>
					<Button
						text={t('admin_media.previous')}
						disabled={page === 0}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
					/>
					<span className={b('page-info')}>
						{t('admin_media.page_of', {current: page + 1, total: pageCount})}
					</span>
					<Button
						text={t('admin_media.next')}
						disabled={page + 1 >= pageCount}
						onClick={() => setPage((p) => p + 1)}
					/>
				</div>
			)}

			{preview && (
				<div className={b('lightbox')} role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
					<button
						type="button"
						className={b('lightbox-close')}
						onClick={() => setPreview(null)}
						aria-label={t('support.modal_close')}
					>
						<X weight="bold" />
					</button>
					<img className={b('lightbox-image')} src={getStorageURL(preview.storage_path)} alt="" />
				</div>
			)}
		</div>
	);
}
