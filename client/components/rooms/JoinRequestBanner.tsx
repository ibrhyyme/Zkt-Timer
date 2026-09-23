import React from 'react';
import {useTranslation} from 'react-i18next';
import {UserPlus} from 'phosphor-react';
import Button from '../common/button/Button';
import type {FriendlyRoomJoinRequestData} from '../../../shared/friendly_room/types';

interface Props {
	requests: FriendlyRoomJoinRequestData[];
	onRespond: (userId: string, accept: boolean) => void;
}

/**
 * People waiting to get into the full room, shown to its owner and moderators only.
 *
 * Pinned below the room header rather than in the chat or the notification log: someone is
 * sitting on a waiting screen until this is answered, so it has to be seen during a solve
 * session, not scrolled past.
 */
export default function JoinRequestBanner({requests, onRespond}: Props) {
	const {t} = useTranslation();
	if (!requests.length) return null;

	return (
		<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[150] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2 md:top-[calc(var(--nav-h)+4.5rem)]">
			{requests.map((request) => (
				<div
					key={request.user_id}
					role="alert"
					className="flex items-center gap-3 rounded-xl border border-text/[0.15] bg-module px-4 py-3 shadow-2xl"
				>
					<UserPlus size={22} weight="bold" className="shrink-0 text-blue-400" />
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-bold text-text">
							{t('rooms.join_request_banner', {username: request.username})}
						</div>
						<div className="text-xs font-medium text-text">{t('rooms.join_request_banner_desc')}</div>
					</div>
					<div className="flex shrink-0 gap-2">
						<Button small gray onClick={() => onRespond(request.user_id, false)}>
							{t('rooms.join_request_reject')}
						</Button>
						<Button small primary onClick={() => onRespond(request.user_id, true)}>
							{t('rooms.join_request_accept')}
						</Button>
					</div>
				</div>
			))}
		</div>
	);
}
