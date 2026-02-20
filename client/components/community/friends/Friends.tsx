import React from 'react';
import {useTranslation} from 'react-i18next';
import './Friends.scss';
import {FRIENDSHIP_FRAGMENT, FRIENDSHIP_REQUEST_FRAGMENT} from '../../../util/graphql/fragments';
import ProfileRow from '../profile_row/ProfileRow';
import Pagination, {PaginationTab} from '../../common/pagination/Pagination';
import {PublicUserAccount} from '../../../@types/generated/graphql';
import FriendshipRequest from '../../profile/friendship_request/FriendshipRequest';
import block from '../../../styles/bem';

const b = block('community__friends');

const tabIdToOtherUserMap = {
	friends: 'other_user',
	received: 'from_user',
	sent: 'to_user',
};

export default function Friends() {
	const {t} = useTranslation();

	const tabs: PaginationTab[] = [
		{
			id: 'friends',
			value: t('friends.friends_tab'),
			dataQueryName: 'friendships',
			queryFragment: FRIENDSHIP_FRAGMENT,
			queryFragmentName: 'FriendshipFragment',
			link: '/community/friends/list',
			plural: t('friends.friends_count'),
		},
		{
			id: 'received',
			value: t('friends.received_tab'),
			dataQueryName: 'friendshipRequestsReceived',
			queryFragment: FRIENDSHIP_REQUEST_FRAGMENT,
			queryFragmentName: 'FriendshipRequestFragment',
			link: '/community/friends/received',
			plural: t('friends.received_count'),
		},
		{
			id: 'sent',
			value: t('friends.sent_tab'),
			dataQueryName: 'friendshipRequestsSent',
			queryFragment: FRIENDSHIP_REQUEST_FRAGMENT,
			queryFragmentName: 'FriendshipRequestFragment',
			link: '/community/friends/sent',
			plural: t('friends.sent_count'),
		},
	];
	return (
		<div className={b()}>
			<Pagination
				tabs={tabs}
				itemRow={(friend, tab) => {
					const otherUser: PublicUserAccount = friend[tabIdToOtherUserMap[tab.id]];

					return (
						<ProfileRow
							getRightMessage={<FriendshipRequest user={otherUser} />}
							hideDropdown
							user={otherUser}
							key={friend.id}
						/>
					);
				}}
			/>
		</div>
	);
}
