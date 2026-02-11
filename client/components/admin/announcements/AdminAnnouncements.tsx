import React, { useState, useEffect } from 'react';
import { Plus, Trash, PencilSimple, Eye } from 'phosphor-react';
import { GetAllAnnouncementsDocument, DeleteAnnouncementDocument, Announcement } from '../../../@types/generated/graphql';
import { gqlQueryTyped, gqlMutateTyped } from '../../api';
import CreateAnnouncementModal from './CreateAnnouncementModal';
import AnnouncementModal from '../../announcements/AnnouncementModal';

export default function AdminAnnouncements() {
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
		if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;

		try {
			await gqlMutateTyped(DeleteAnnouncementDocument, { id });
			fetchAnnouncements();
		} catch (error) {
			alert('Duyuru silinemedi');
		}
	};

	const CATEGORY_LABELS: Record<string, string> = {
		FEATURE: '🎉 Yenilik',
		BUGFIX: '🔧 Düzeltme',
		IMPORTANT: '⚠️ Önemli',
		INFO: 'ℹ️ Bilgi'
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="flex justify-between items-end mb-8">
				<div>
					<h1 className="text-3xl font-bold text-white mb-2">Duyuru Yönetimi</h1>
					<p className="text-gray-400">Sistemdeki tüm duyuruları buradan yönetebilirsiniz.</p>
				</div>
				<button
					onClick={() => setShowCreateModal(true)}
					className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
				>
					<Plus size={20} weight="bold" />
					Yeni Duyuru Oluştur
				</button>
			</div>

			{/* Filters */}
			<div className="flex gap-4 mb-6 bg-[#1e1e24] p-2 rounded-xl border border-white/5 w-fit">
				<select
					value={filter.category}
					onChange={(e) => setFilter({ ...filter, category: e.target.value })}
					className="px-4 py-2 bg-transparent text-gray-300 border-r border-white/5 focus:outline-none focus:text-white"
				>
					<option value="">Tüm Kategoriler</option>
					<option value="FEATURE">Yenilik</option>
					<option value="BUGFIX">Düzeltme</option>
					<option value="IMPORTANT">Önemli</option>
					<option value="INFO">Bilgi</option>
				</select>

				<select
					value={filter.isDraft === undefined ? '' : filter.isDraft.toString()}
					onChange={(e) => setFilter({ ...filter, isDraft: e.target.value === '' ? undefined : e.target.value === 'true' })}
					className="px-4 py-2 bg-transparent text-gray-300 focus:outline-none focus:text-white"
				>
					<option value="">Tümü</option>
					<option value="true">Taslaklar</option>
					<option value="false">Yayınlananlar</option>
				</select>
			</div>

			{/* Table Card */}
			<div className="bg-[#1e1e24] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
				{loading ? (
					<div className="flex flex-col items-center justify-center py-20 text-gray-400">
						<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
						<p>Duyurular yükleniyor...</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-white/5 border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
									<th className="p-5 font-semibold">Duyuru Başlığı</th>
									<th className="p-5 font-semibold">Kategori</th>
									<th className="p-5 font-semibold text-center">Öncelik</th>
									<th className="p-5 font-semibold">Durum</th>
									<th className="p-5 font-semibold">Görüntülenme</th>
									<th className="p-5 font-semibold">Tarih</th>
									<th className="p-5 font-semibold text-right">İşlemler</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/5">
								{announcements.length === 0 ? (
									<tr>
										<td colSpan={7} className="p-12 text-center text-gray-500">
											Henüz hiç duyuru bulunmuyor.
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
															TASLAK
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
													{announcement.isActive ? 'Yayında' : 'Pasif'}
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
														title="Sil"
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
