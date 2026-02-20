import React, { useState, useEffect } from 'react';
import {useTranslation} from 'react-i18next';
import { Plus, Trash, PencilSimple, Eye } from 'phosphor-react';
import { GetAllAnnouncementsDocument, DeleteAnnouncementDocument, Announcement } from '../../../@types/generated/graphql';
import { gqlQueryTyped, gqlMutateTyped } from '../../api';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementModal from '../../announcements/AnnouncementModal';

export default function AdminAnnouncements() {
	const {t} = useTranslation();
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
	const [filter, setFilter] = useState({ category: '', isDraft: undefined as boolean | undefined });

	useEffect(() => {
		fetchAnnouncements();
	}, [filter]);

	const fetchAnnouncements = async () => {
		try {
			setLoading(true);
			const res = await gqlQueryTyped(GetAllAnnouncementsDocument, { filter }, {
				fetchPolicy: 'network-only'
			});
			setAnnouncements(res.data?.getAllAnnouncements || []);
		} catch (error) {
			console.error('Failed to fetch announcements:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (!confirm(t('admin_announcements.delete_confirm'))) return;

		try {
			await gqlMutateTyped(DeleteAnnouncementDocument, { id });
			fetchAnnouncements();
		} catch (error) {
			alert(t('admin_announcements.delete_error'));
		}
	};

	const CATEGORY_LABELS: Record<string, string> = {
		FEATURE: t('admin_announcements.category_feature'),
		BUGFIX: t('admin_announcements.category_bugfix'),
		IMPORTANT: t('admin_announcements.category_important'),
		INFO: t('admin_announcements.category_info')
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="flex justify-between items-end mb-8">
				<div>
					<h1 className="text-3xl font-bold text-white mb-2">{t('admin_announcements.title')}</h1>
					<p className="text-gray-400">{t('admin_announcements.subtitle')}</p>
				</div>
				<button
					onClick={() => setShowCreateModal(true)}
					className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
				>
					<Plus size={20} weight="bold" />
					{t('admin_announcements.create_button')}
				</button>
			</div>

			{/* Filters */}
			<div className="flex gap-4 mb-6 bg-[#1e1e24] p-2 rounded-xl border border-white/5 w-fit">
				<select
					value={filter.category}
					onChange={(e) => setFilter({ ...filter, category: e.target.value })}
					className="px-4 py-2 bg-transparent text-gray-300 border-r border-white/5 focus:outline-none focus:text-white"
				>
					<option value="">{t('admin_announcements.filter_all_categories')}</option>
					<option value="FEATURE">{t('admin_announcements.filter_feature')}</option>
					<option value="BUGFIX">{t('admin_announcements.filter_bugfix')}</option>
					<option value="IMPORTANT">{t('admin_announcements.filter_important')}</option>
					<option value="INFO">{t('admin_announcements.filter_info')}</option>
				</select>

				<select
					value={filter.isDraft === undefined ? '' : filter.isDraft.toString()}
					onChange={(e) => setFilter({ ...filter, isDraft: e.target.value === '' ? undefined : e.target.value === 'true' })}
					className="px-4 py-2 bg-transparent text-gray-300 focus:outline-none focus:text-white"
				>
					<option value="">{t('admin_announcements.filter_all')}</option>
					<option value="true">{t('admin_announcements.filter_drafts')}</option>
					<option value="false">{t('admin_announcements.filter_published')}</option>
				</select>
			</div>

			{/* Table Card */}
			<div className="bg-[#1e1e24] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
				{loading ? (
					<div className="flex flex-col items-center justify-center py-20 text-gray-400">
						<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
						<p>{t('admin_announcements.loading')}</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-white/5 border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
									<th className="p-5 font-semibold">{t('admin_announcements.th_title')}</th>
									<th className="p-5 font-semibold">{t('admin_announcements.th_category')}</th>
									<th className="p-5 font-semibold text-center">{t('admin_announcements.th_priority')}</th>
									<th className="p-5 font-semibold">{t('admin_announcements.th_status')}</th>
									<th className="p-5 font-semibold">{t('admin_announcements.th_views')}</th>
									<th className="p-5 font-semibold">{t('admin_announcements.th_date')}</th>
									<th className="p-5 font-semibold text-right">{t('admin_announcements.th_actions')}</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/5">
								{announcements.length === 0 ? (
									<tr>
										<td colSpan={7} className="p-12 text-center text-gray-500">
											{t('admin_announcements.no_announcements')}
										</td>
									</tr>
								) : (
									announcements.map((announcement) => (
										<tr
											key={announcement.id}
											onClick={() => setSelectedAnnouncement(announcement)}
											className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
										>
											<td className="p-5">
												<div className="flex items-center gap-3">
													<div className={`w-2 h-2 rounded-full ${announcement.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
													<span className="font-medium text-white group-hover:text-indigo-300 transition-colors">
														{announcement.title}
													</span>
													{announcement.isDraft && (
														<span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 font-medium">
															{t('admin_announcements.draft_badge')}
														</span>
													)}
												</div>
											</td>
											<td className="p-5">
												<span className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/5">
													{CATEGORY_LABELS[announcement.category] || announcement.category}
												</span>
											</td>
											<td className="p-5 text-center">
												<span className="font-mono text-gray-400">{announcement.priority}</span>
											</td>
											<td className="p-5">
												<span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${announcement.isActive
													? 'bg-green-500/10 text-green-400 border-green-500/20'
													: 'bg-red-500/10 text-red-400 border-red-500/20'
													}`}>
													{announcement.isActive ? t('admin_announcements.status_active') : t('admin_announcements.status_inactive')}
												</span>
											</td>
											<td className="p-5">
												<div className="flex items-center gap-2 text-gray-400">
													<Eye size={16} />
													<span>{announcement.viewCount || 0}</span>
												</div>
											</td>
											<td className="p-5 text-sm text-gray-400 font-mono">
												{new Date(announcement.createdAt).toLocaleDateString('tr-TR')}
											</td>
											<td className="p-5">
												<div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
													<button
														onClick={(e) => handleDelete(e, announcement.id)}
														className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition border border-red-500/20"
														title={t('admin_announcements.delete_button')}
													>
														<Trash size={18} />
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create Modal */}
			{showCreateModal && (
				<CreateAnnouncementModal
					onClose={() => {
						setShowCreateModal(false);
						fetchAnnouncements();
					}}
				/>
			)}

			{/* View Modal */}
			{selectedAnnouncement && (
				<AnnouncementModal
					announcement={selectedAnnouncement}
					onClose={() => setSelectedAnnouncement(null)}
				/>
			)}
		</div>
	);
}
