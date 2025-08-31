import React from 'react';
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

const tabs: PaginationTab[] = [
	{
		id: 'friends',
		value: 'Arkadaşlar',
		dataQueryName: 'friendships',
		queryFragment: FRIENDSHIP_FRAGMENT,
		queryFragmentName: 'FriendshipFragment',
		link: '/community/friends/list',
		plural: 'arkadaş',
	},
	{
		id: 'received',
		value: 'Gelen',
		dataQueryName: 'friendshipRequestsReceived',
		queryFragment: FRIENDSHIP_REQUEST_FRAGMENT,
		queryFragmentName: 'FriendshipRequestFragment',
		link: '/community/friends/received',
		plural: 'gelen istek',
	},
	{
		id: 'sent',
		value: 'Gönderilen',
		dataQueryName: 'friendshipRequestsSent',
		queryFragment: FRIENDSHIP_REQUEST_FRAGMENT,
		queryFragmentName: 'FriendshipRequestFragment',
		link: '/community/friends/sent',
		plural: 'gönderilen istek',
	},
];

export default function Friends() {
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
