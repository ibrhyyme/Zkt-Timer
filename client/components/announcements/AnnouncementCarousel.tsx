import React, { useEffect, useState } from 'react';
import { Announcement } from '../../@types/generated/graphql';
import AnnouncementModal from './AnnouncementModal';
import { markAnnouncementViewed } from '../../util/announcements';
import { noteAnnouncementShown } from '../../lib/feature_tips/store';

interface AnnouncementCarouselProps {
	announcements: Announcement[];
	onClose: () => void;
}

export default function AnnouncementCarousel(props: AnnouncementCarouselProps) {
	const { announcements, onClose } = props;
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isClosing, setIsClosing] = useState(false);

	// This app open belongs to the announcement: a feature tip waits for the next one.
	useEffect(() => {
		noteAnnouncementShown();
	}, []);

	const currentAnnouncement = announcements[currentIndex];
	const isLast = currentIndex === announcements.length - 1;

	const markAsViewed = async (announcementId: string) => {
		try {
			await markAnnouncementViewed(announcementId);
		} catch (error) {
			console.error('Failed to mark announcement as viewed:', error);
		}
	};

	const handleNext = async () => {
		// Mark current announcement as viewed
		await markAsViewed(currentAnnouncement.id);

		if (isLast) {
			handleClose();
		} else {
			setCurrentIndex(prev => prev + 1);
		}
	};

	const handleClose = async () => {
		setIsClosing(true);

		// Only mark current announcement as viewed
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
