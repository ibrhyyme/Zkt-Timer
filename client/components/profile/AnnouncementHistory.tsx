import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GetMyAnnouncementHistoryDocument, Announcement } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import AnnouncementModal from '../announcements/AnnouncementModal';

export default function AnnouncementHistory() {
	const { t } = useTranslation();
	const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [page, setPage] = useState(0);
	const limit = 20;

	useEffect(() => {
		fetchHistory();
	}, [page]);

	const fetchHistory = async () => {
		try {
			setLoading(true);
			const res = await gqlQueryTyped(GetMyAnnouncementHistoryDocument, {
				limit,
				offset: page * limit
			}, {
				fetchPolicy: 'network-only'
			});

			setAnnouncements(res.data?.getMyAnnouncementHistory || []);
			setError(false);
		} catch (err) {
			console.error('Failed to fetch history:', err);
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	const CATEGORY_LABELS: Record<string, string> = {
		FEATURE: t('profile.category_feature'),
		BUGFIX: t('profile.category_bugfix'),
		IMPORTANT: t('profile.category_important'),
		INFO: t('profile.category_info')
	};

	if (loading) return <div className="text-center py-12">{t('profile.loading')}</div>;
	if (error) return <div className="text-center py-12 text-red-400">{t('profile.history_load_error')}</div>;

	return (
		<div>
			{announcements.length === 0 ? (
				<div className="text-center py-12 text-zinc-400">
					{t('profile.no_announcement_history')}
				</div>
			) : (
				<div className="space-y-4">
					{announcements.map((announcement) => (
						<button
							key={announcement.id}
							onClick={() => setSelectedAnnouncement(announcement)}
							className="w-full p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition text-left"
						>
							<div className="flex justify-between items-start mb-2">
								<h3 className="font-semibold">{announcement.title}</h3>
								<span className="px-2 py-1 rounded text-xs bg-zinc-700 text-zinc-300">
									{CATEGORY_LABELS[announcement.category]}
								</span>
							</div>
							<p className="text-sm text-zinc-400">
								{new Date(announcement.createdAt).toLocaleDateString('tr-TR')}
							</p>
						</button>
					))}
				</div>
			)}

			{/* Pagination */}
			{announcements.length === limit && (
				<div className="mt-6 flex justify-center gap-2">
					<button
						onClick={() => setPage(p => Math.max(0, p - 1))}
						disabled={page === 0}
						className="px-4 py-2 border border-zinc-700 rounded-lg disabled:opacity-50"
					>
						{t('profile.previous')}
					</button>
					<button
						onClick={() => setPage(p => p + 1)}
						className="px-4 py-2 border border-zinc-700 rounded-lg"
					>
						{t('profile.next')}
					</button>
				</div>
			)}

			{/* Modal */}
			{selectedAnnouncement && (
				<AnnouncementModal
					announcement={selectedAnnouncement}
					onClose={() => setSelectedAnnouncement(null)}
				/>
			)}
		</div>
	);
}
