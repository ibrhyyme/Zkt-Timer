import React, { useState, useEffect } from 'react';
import { Plus, Trash, PencilSimple, Eye } from 'phosphor-react';
import { GetAllAnnouncementsDocument, DeleteAnnouncementDocument, Announcement } from '../../../@types/generated/graphql';
import { gqlQueryTyped, gqlMutateTyped } from '../../api';
import CreateAnnouncementModal from './CreateAnnouncementModal';

export default function AdminAnnouncements() {
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
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

	const handleDelete = async (id: string) => {
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
		<div className="p-6">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">Duyuru Yönetimi</h1>
				<button
					onClick={() => setShowCreateModal(true)}
					className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
				>
					<Plus weight="bold" />
					Yeni Duyuru
				</button>
			</div>

			{/* Filters */}
			<div className="flex gap-4 mb-6">
				<select
					value={filter.category}
					onChange={(e) => setFilter({ ...filter, category: e.target.value })}
					className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
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
					className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
				>
					<option value="">Tümü</option>
					<option value="false">Yayınlananlar</option>
					<option value="true">Taslaklar</option>
				</select>
			</div>

			{/* Table */}
			{loading ? (
				<div className="text-center py-12">Yükleniyor...</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-zinc-700">
								<th className="text-left p-4">Başlık</th>
								<th className="text-left p-4">Kategori</th>
								<th className="text-left p-4">Öncelik</th>
								<th className="text-left p-4">Durum</th>
								<th className="text-left p-4">Görüntülenme</th>
								<th className="text-left p-4">Tarih</th>
								<th className="text-right p-4">İşlemler</th>
							</tr>
						</thead>
						<tbody>
							{announcements.map((announcement) => (
								<tr key={announcement.id} className="border-b border-zinc-700 hover:bg-zinc-800">
									<td className="p-4">
										{announcement.title}
										{announcement.isDraft && (
											<span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
												Taslak
											</span>
										)}
									</td>
									<td className="p-4">
										<span className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300">
											{CATEGORY_LABELS[announcement.category]}
										</span>
									</td>
									<td className="p-4">{announcement.priority}</td>
									<td className="p-4">
										<span className={`px-2 py-1 rounded text-xs ${announcement.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
											{announcement.isActive ? 'Aktif' : 'Pasif'}
										</span>
									</td>
									<td className="p-4 flex items-center gap-2">
										<Eye size={16} />
										{announcement.viewCount || 0}
									</td>
									<td className="p-4 text-sm text-zinc-400">
										{new Date(announcement.createdAt).toLocaleDateString('tr-TR')}
									</td>
									<td className="p-4">
										<div className="flex justify-end gap-2">
											<button
												onClick={() => handleDelete(announcement.id)}
												className="p-2 hover:bg-red-500/20 text-red-400 rounded"
											>
												<Trash size={18} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Create Modal */}
			{showCreateModal && (
				<CreateAnnouncementModal
					onClose={() => {
						setShowCreateModal(false);
						fetchAnnouncements();
					}}
				/>
			)}
		</div>
	);
}
