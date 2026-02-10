import React, { useState, useEffect } from 'react';
import { GetActiveAnnouncementsDocument, Announcement } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import AnnouncementCarousel from './AnnouncementCarousel';

interface AnnouncementDropdownProps {
	onClose: () => void;
	unreadCount: number;
}

export default function AnnouncementDropdown(props: AnnouncementDropdownProps) {
	const { onClose, unreadCount } = props;
	const [showCarousel, setShowCarousel] = useState(false);
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		fetchAnnouncements();
	}, []);

	const fetchAnnouncements = async () => {
		try {
			setLoading(true);
			const res = await gqlQueryTyped(GetActiveAnnouncementsDocument, {}, {
				fetchPolicy: 'network-only'
			});

			setAnnouncements(res.data?.getActiveAnnouncements || []);
			setError(false);
		} catch (err) {
			console.error('Failed to fetch announcements:', err);
			setError(true);
		} finally {
			setLoading(false);
		}
	};

	if (showCarousel && announcements.length > 0) {
		return (
			<AnnouncementCarousel
				announcements={announcements}
				onClose={() => {
					setShowCarousel(false);
					onClose();
				}}
			/>
		);
	}

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-[200]"
				onClick={onClose}
			/>

			{/* Dropdown */}
			<div className="absolute right-0 top-full mt-2 w-80 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-[201] overflow-hidden">
				<div className="p-4 border-b border-zinc-700">
					<h3 className="font-semibold">Duyurular</h3>
					{unreadCount > 0 && (
						<p className="text-sm text-zinc-400 mt-1">
							{unreadCount} okunmamış duyuru
						</p>
					)}
				</div>

				{loading ? (
					<div className="p-8 text-center text-zinc-400">
						Yükleniyor...
					</div>
				) : error ? (
					<div className="p-8 text-center text-red-400">
						Duyurular yüklenemedi
					</div>
				) : announcements.length === 0 ? (
					<div className="p-8 text-center text-zinc-400">
						Yeni duyuru yok
					</div>
				) : (
					<>
						<div className="max-h-64 overflow-y-auto">
							{announcements.slice(0, 3).map((announcement) => (
								<button
									key={announcement.id}
									onClick={() => setShowCarousel(true)}
									className="w-full p-4 hover:bg-zinc-700 transition text-left border-b border-zinc-700 last:border-0"
								>
									<p className="font-medium">{announcement.title}</p>
									<p className="text-sm text-zinc-400 mt-1 line-clamp-2">
										{announcement.content.substring(0, 100)}...
									</p>
								</button>
							))}
						</div>

						<div className="p-3 border-t border-zinc-700">
							<button
								onClick={() => setShowCarousel(true)}
								className="w-full text-center text-sm text-blue-400 hover:text-blue-300 transition"
							>
								Tümünü Görüntüle ({announcements.length})
							</button>
						</div>
					</>
				)}
			</div>
		</>
	);
}
