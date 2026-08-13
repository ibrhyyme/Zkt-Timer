import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GetMyAnnouncementHistoryDocument, Announcement } from '../../@types/generated/graphql';
import { gqlQueryTyped } from '../api';
import AnnouncementModal from '../announcements/AnnouncementModal';
import { Megaphone } from 'phosphor-react';
import Button from '../common/button/Button';
import Loading from '../common/loading/Loading';
import SettingsCard from '../account/common/settings_card/SettingsCard';
import block from '../../styles/bem';
import './AnnouncementHistory.scss';

const b = block('announcement-history');

export default function AnnouncementHistory() {
	const { t, i18n } = useTranslation();
	const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
	const [announcements, setAnnouncements] = useState<Announcement[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [page, setPage] = useState(0);
	const limit = 20;

	useEffect(() => {
		fetchHistory();
	}, [page, i18n.language]);

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

	if (loading) return <Loading />;
	if (error) return <p className={b('error')}>{t('profile.history_load_error')}</p>;

	return (
		<div className={b()}>
			<SettingsCard title={t('account_nav.announcements')} icon={<Megaphone weight="fill" />}>
				{announcements.length === 0 ? (
					<p className={b('empty')}>{t('profile.no_announcement_history')}</p>
				) : (
					<div className={b('list')}>
						{announcements.map((announcement) => (
							<button
								key={announcement.id}
								type="button"
								onClick={() => setSelectedAnnouncement(announcement)}
								className={b('item')}
							>
								<span className={b('item-head')}>
									<span className={b('item-title')}>{announcement.title}</span>
									<span className={b('item-category', {type: announcement.category?.toLowerCase()})}>
										{CATEGORY_LABELS[announcement.category]}
									</span>
								</span>
								<span className={b('item-date')}>
									{new Date(announcement.createdAt).toLocaleDateString(i18n.language)}
								</span>
							</button>
						))}
					</div>
				)}
			</SettingsCard>

			{announcements.length === limit && (
				<div className={b('pagination')}>
					<Button
						gray
						text={t('profile.previous')}
						disabled={page === 0}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
					/>
					<Button gray text={t('profile.next')} onClick={() => setPage((p) => p + 1)} />
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
