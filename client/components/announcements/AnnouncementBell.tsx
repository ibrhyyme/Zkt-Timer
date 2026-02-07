import React, { useState, useEffect } from 'react';
import { Bell } from 'phosphor-react';
import { GetUnreadAnnouncementCountDocument } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import AnnouncementDropdown from './AnnouncementDropdown';

export default function AnnouncementBell() {
	const [isOpen, setIsOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);

	const fetchUnreadCount = async () => {
		try {
			const res = await gqlQueryTyped(GetUnreadAnnouncementCountDocument, {}, {
				fetchPolicy: 'network-only'
			});

			setUnreadCount(res.data?.getUnreadAnnouncementCount?.count || 0);
		} catch (error) {
			console.error('Failed to fetch unread count:', error);
		}
	};

	useEffect(() => {
		fetchUnreadCount();

		// Her 1 dakikada bir güncelle
		const interval = setInterval(fetchUnreadCount, 60000);

		return () => clearInterval(interval);
	}, []);

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="relative p-2 hover:bg-zinc-700 rounded-lg transition"
				aria-label="Duyurular"
			>
				<Bell size={24} weight={unreadCount > 0 ? 'fill' : 'regular'} />

				{/* Badge */}
				{unreadCount > 0 && (
					<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				)}
			</button>

			{/* Dropdown */}
			{isOpen && (
				<AnnouncementDropdown
					onClose={() => {
						setIsOpen(false);
						fetchUnreadCount(); // Dropdown kapandığında count'u güncelle
					}}
					unreadCount={unreadCount}
				/>
			)}
		</div>
	);
}
