import React, { useState } from 'react';
import { Announcement, MarkAnnouncementAsViewedDocument } from '../../@types/generated/graphql';
import AnnouncementModal from './AnnouncementModal';
import { gqlMutateTyped } from '../api';

interface AnnouncementCarouselProps {
	announcements: Announcement[];
	onClose: () => void;
}

export default function AnnouncementCarousel(props: AnnouncementCarouselProps) {
	const { announcements, onClose } = props;
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isClosing, setIsClosing] = useState(false);

	const currentAnnouncement = announcements[currentIndex];
	const isLast = currentIndex === announcements.length - 1;

	const markAsViewed = async (announcementId: string) => {
		try {
			await gqlMutateTyped(MarkAnnouncementAsViewedDocument, {
				announcementId
			});
		} catch (error) {
			console.error('Failed to mark announcement as viewed:', error);
		}
	};

	const handleNext = async () => {
		// Mevcut duyuruyu mark as viewed
		await markAsViewed(currentAnnouncement.id);

		if (isLast) {
			handleClose();
		} else {
			setCurrentIndex(prev => prev + 1);
		}
	};

	const handleClose = async () => {
		setIsClosing(true);

		// Sadece mevcut duyuruyu mark as viewed
		await markAsViewed(currentAnnouncement.id);

		onClose();
	};

	if (!currentAnnouncement) {
		return null;
	}

	return (
		<AnnouncementModal
			announcement={currentAnnouncement}
			onClose={handleClose}
			onNext={isLast ? undefined : handleNext}
			currentIndex={currentIndex}
			totalCount={announcements.length}
			isCarousel={true}
			isClosing={isClosing}
		/>
	);
}
