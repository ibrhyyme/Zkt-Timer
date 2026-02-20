import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MagnifyingGlass, Check } from 'phosphor-react';
import { gqlQueryTyped } from '../../api';
import { gql } from '@apollo/client';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import { useTranslation } from 'react-i18next';

const ADMIN_USER_SEARCH_QUERY = gql`
	query AdminUserSearch($pageArgs: PaginationArgsInput) {
		adminUserSearch(pageArgs: $pageArgs) {
			hasMore
			total
			items {
				id
				username
				email
				verified
				created_at
				last_solve_at
				join_country
				banned_forever
				is_pro
				banned_until
				admin
				mod
				profile {
					pfp_image {
						storage_path
					}
				}
			}
		}
	}
`;

export interface SelectedUser {
	id: string;
	username: string;
	email: string;
}

interface UserData {
	id: string;
	username: string;
	email: string;
	verified: boolean;
	banned_forever: boolean;
	banned_until?: string;
	is_pro: boolean;
	admin: boolean;
	mod: boolean;
	profile?: {
		pfp_image?: {
			storage_path?: string;
		};
	};
}

interface RecipientSelectorProps {
	selectedUsers: Map<string, SelectedUser>;
	onConfirm: (users: Map<string, SelectedUser>) => void;
	onClose: () => void;
}

export default function RecipientSelector(props: RecipientSelectorProps) {
	const { selectedUsers: initialSelected, onConfirm, onClose } = props;
	const { t } = useTranslation();

	const [search, setSearch] = useState('');
	const [users, setUsers] = useState<UserData[]>([]);
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(0);
	const [hasMore, setHasMore] = useState(true);
	const [total, setTotal] = useState(0);
	const [selected, setSelected] = useState<Map<string, SelectedUser>>(
		new Map(initialSelected)
	);

	async function fetchUsers(currentPage: number) {
		setLoading(true);
		try {
			const res = await gqlQueryTyped(
				ADMIN_USER_SEARCH_QUERY,
				{
					pageArgs: {
						page: currentPage,
						searchQuery: search,
						pageSize: 50,
					},
				},
				{ fetchPolicy: 'network-only' }
			);

			if (res.data?.adminUserSearch) {
				setUsers(res.data.adminUserSearch.items);
				setHasMore(res.data.adminUserSearch.hasMore);
				setTotal(res.data.adminUserSearch.total);
			}
		} catch (error) {
			console.error('Error fetching users:', error);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		setPage(0);
		fetchUsers(0);
	}, [search]);

	const toggleUser = (user: UserData) => {
		const newSelected = new Map(selected);
		if (newSelected.has(user.id)) {
			newSelected.delete(user.id);
		} else {
			newSelected.set(user.id, {
				id: user.id,
				username: user.username,
				email: user.email,
			});
		}
		setSelected(newSelected);
	};

	const togglePageAll = () => {
		const newSelected = new Map(selected);
		const allPageSelected = users.every((u) => newSelected.has(u.id));

		if (allPageSelected) {
			users.forEach((u) => newSelected.delete(u.id));
		} else {
			users.forEach((u) => {
				newSelected.set(u.id, {
					id: u.id,
					username: u.username,
					email: u.email,
				});
			});
		}
		setSelected(newSelected);
	};

	const handlePrevPage = () => {
		if (page > 0) {
			const newPage = page - 1;
			setPage(newPage);
			fetchUsers(newPage);
		}
	};

	const handleNextPage = () => {
		if (hasMore) {
			const newPage = page + 1;
			setPage(newPage);
			fetchUsers(newPage);
		}
	};

	const allPageSelected = users.length > 0 && users.every((u) => selected.has(u.id));

	const modal = (
		<div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60">
			<div className="bg-zinc-800 border border-zinc-700 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="p-5 border-b border-zinc-700 flex justify-between items-center shrink-0">
					<div>
						<h2 className="text-lg font-bold text-white">{t('admin_email.select_recipient')}</h2>
						<p className="text-sm text-gray-400 mt-0.5">
							{t('admin_email.selection_info', { selected: selected.size, total })}
						</p>
					</div>
					<button onClick={onClose} className="p-2 hover:bg-zinc-700 rounded-lg transition">
						<X size={20} className="text-gray-400" />
					</button>
				</div>

				{/* Search */}
				<div className="p-4 border-b border-zinc-700 shrink-0">
					<div className="relative">
						<MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t('admin_email.search_users')}
							className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>
				</div>

				{/* User List */}
				<div className="overflow-y-auto flex-1">
					{loading ? (
						<div className="flex items-center justify-center py-16 text-gray-400">
							<div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
							{t('admin_email.loading')}
						</div>
					) : (
						<table className="w-full text-left">
							<thead className="sticky top-0 bg-zinc-800 z-10">
								<tr className="border-b border-zinc-700 text-xs text-gray-400 uppercase tracking-wider">
									<th className="p-3 w-10">
										<div
											onClick={togglePageAll}
											className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition ${
												allPageSelected
													? 'bg-blue-500 border-blue-500'
													: 'border-zinc-500 bg-zinc-900'
											}`}
										>
											{allPageSelected && <Check size={12} weight="bold" className="text-white" />}
										</div>
									</th>
									<th className="p-3">{t('admin_email.user')}</th>
									<th className="p-3">{t('admin_email.email')}</th>
									<th className="p-3">{t('admin_email.status')}</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-700/50">
								{users.map((user) => (
									<tr
										key={user.id}
										onClick={() => toggleUser(user)}
										className={`hover:bg-zinc-700/30 cursor-pointer transition ${
											selected.has(user.id) ? 'bg-blue-500/10' : ''
										}`}
									>
										<td className="p-3">
											<div
												className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition ${
													selected.has(user.id)
														? 'bg-blue-500 border-blue-500'
														: 'border-zinc-500 bg-zinc-900'
												}`}
											>
												{selected.has(user.id) && <Check size={12} weight="bold" className="text-white" />}
											</div>
										</td>
										<td className="p-3">
											<div className="flex items-center gap-2.5">
												<div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
													<AvatarImage user={user} profile={user.profile} />
												</div>
												<span className="text-white text-sm font-medium">
													{user.username}
												</span>
											</div>
										</td>
										<td className="p-3 text-sm text-gray-400">{user.email}</td>
										<td className="p-3">
											<div className="flex gap-1.5 flex-wrap">
												{user.admin && (
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/20">
														Admin
													</span>
												)}
												{user.mod && (
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/20">
														Mod
													</span>
												)}
												{user.is_pro && (
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">
														Pro
													</span>
												)}
												{user.verified && (
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20">
														{t('admin_email.verified')}
													</span>
												)}
											</div>
										</td>
									</tr>
								))}
								{users.length === 0 && !loading && (
									<tr>
										<td colSpan={4} className="p-8 text-center text-gray-500">
											{t('admin_email.no_users_found')}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					)}
				</div>

				{/* Footer */}
				<div className="p-4 border-t border-zinc-700 flex items-center justify-between shrink-0">
					<div className="flex items-center gap-3">
						<button
							onClick={handlePrevPage}
							disabled={page === 0}
							className="px-3 py-1.5 text-sm border border-zinc-700 rounded-lg hover:bg-zinc-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{t('admin_email.previous')}
						</button>
						<span className="text-sm text-gray-400">{t('admin_email.page', { page: page + 1 })}</span>
						<button
							onClick={handleNextPage}
							disabled={!hasMore}
							className="px-3 py-1.5 text-sm border border-zinc-700 rounded-lg hover:bg-zinc-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
						>
							{t('admin_email.next')}
						</button>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={onClose}
							className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:bg-zinc-700 transition"
						>
							{t('admin_email.cancel')}
						</button>
						<button
							onClick={() => onConfirm(selected)}
							className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
						>
							{t('admin_email.select_people', { count: selected.size })}
						</button>
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
