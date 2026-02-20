import React, { useEffect, useState } from 'react';
import {useTranslation} from 'react-i18next';
import { X, Plus, Timer, Check } from 'phosphor-react';
import { addFriendship, removeFriendship } from '../../../actions/account';
import { toastSuccess } from '../../../util/toast';
import { gqlMutate, gqlMutateTyped, gqlQueryTyped } from '../../api';
import Button, { ButtonProps } from '../../common/button/Button';
import {
	FriendshipRequest as FriendshipRequestSchema,
	AcceptFriendshipRequestDocument,
	DeleteFriendshipRequestDocument,
	UnfriendDocument,
	ReceivedFriendshipRequestsFromUserDocument,
	SentFriendshipRequestsToUserDocument,
	SendFriendshipRequestDocument,
	PublicUserAccount as GqlPublicUserAccount,
} from '../../../@types/generated/graphql';
import { useDispatch, useSelector } from 'react-redux';
import { useMe } from '../../../util/hooks/useMe';
import { PublicUserAccount } from '../../../../server/schemas/UserAccount.schema';

// Combined type for user prop
type FriendshipRequestUser = PublicUserAccount | GqlPublicUserAccount;

interface Props {
	user: FriendshipRequestUser;
	fetchData?: boolean;
	friendRequestSent?: FriendshipRequestSchema;
	friendRequestReceived?: FriendshipRequestSchema;
}

export default function FriendshipRequest(props: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();

	const { user, fetchData } = props;

	const me = useMe();
	const friends = useSelector((state: any) => state.account?.friends);

	const [loading, setLoading] = useState(fetchData);
	const [friendRequestSent, setFriendRequestSent] = useState(props.friendRequestSent);
	const [friendRequestReceived, setFriendRequestReceived] = useState(props.friendRequestReceived);
	const [overFriendButton, setOverFriendButton] = useState(false);

	useEffect(() => {
		getFriendshipRequests(user.id)
			.then(({ sentRequest, receivedRequest }) => {
				setLoading(false);
				setFriendRequestSent(sentRequest);
				setFriendRequestReceived(receivedRequest);
			})
			.catch((error) => {
				console.error('Failed to fetch friendship requests:', error);
				setLoading(false);
			});
	}, []);

	async function getFriendshipRequests(userId: string) {
		const vars = {
			userId,
		};

		const [sent, requested] = await Promise.all([
			gqlQueryTyped(ReceivedFriendshipRequestsFromUserDocument, vars),
			gqlQueryTyped(SentFriendshipRequestsToUserDocument, vars),
		]);

		const setReqs = sent.data.receivedFriendshipRequestsFromUser;
		const requestedReqs = requested.data.sentFriendshipRequestsToUser;

		const sentRequest = setReqs && setReqs.length ? setReqs[0] : null;
		const receivedRequest = requestedReqs && requestedReqs.length ? requestedReqs[0] : null;

		return { sentRequest, receivedRequest };
	}

	async function friendshipButton() {
		if (friends && friends[user.id]) {
			await gqlMutate(UnfriendDocument, {
				targetUserId: user.id,
			});

			dispatch(removeFriendship(user.id));
			toastSuccess(t('friendship.unfriended', { username: user.username }));

			setFriendRequestReceived(null);
			setFriendRequestSent(null);
		} else if (friendRequestSent) {
			await gqlMutate(DeleteFriendshipRequestDocument, {
				friendshipRequestId: friendRequestSent.id,
			});

			toastSuccess(t('friendship.request_cancelled', { username: user.username }));

			setFriendRequestReceived(null);
			setFriendRequestSent(null);
		} else if (friendRequestReceived) {
			const res = await gqlMutateTyped(AcceptFriendshipRequestDocument, {
				friendshipRequestId: friendRequestReceived.id,
			});

			toastSuccess(t('friendship.request_accepted', { username: user.username }));
			dispatch(addFriendship(res.data.acceptFriendshipRequest as any));

			setFriendRequestReceived(null);
			setFriendRequestSent(null);
		} else {
			const request = await gqlMutateTyped(SendFriendshipRequestDocument, {
				toUserId: user.id,
			});

			toastSuccess(t('friendship.request_sent', { username: user.username }));

			setFriendRequestReceived(null);
			setFriendRequestSent(request.data.sendFriendshipRequest);
		}
	}

	function getFriendButtonParams(): ButtonProps {
		let friendButtonParams: ButtonProps = {
			text: t('friendship.add_friend'),
			icon: <Plus weight="bold" />,
			gray: true,
		};

		if (friends && friends[user.id]) {
			friendButtonParams = {
				text: t('friendship.friends'),
				icon: <Check weight="bold" />,
				gray: true,
			};

			if (overFriendButton) {
				friendButtonParams = {
					text: t('friendship.unfriend'),
					icon: <X weight="bold" />,
					danger: true,
				};
			}
		} else if (friendRequestReceived) {
			friendButtonParams = {
				text: t('friendship.accept_request'),
				icon: <Plus weight="bold" />,
				primary: true,
			};
		} else if (friendRequestSent) {
			friendButtonParams = {
				text: t('friendship.request_sent_status'),
				icon: <Timer weight="bold" />,
				warning: true,
			};

			if (overFriendButton) {
				friendButtonParams = {
					text: t('friendship.cancel_request'),
					icon: <X weight="bold" />,
					danger: true,
				};
			}
		}

		return friendButtonParams;
	}

	const friendButtonParams = getFriendButtonParams();

	let friendButton = (
		<Button
			onClick={friendshipButton}
			onMouseOver={() => setOverFriendButton(true)}
			onMouseOut={() => setOverFriendButton(false)}
			{...friendButtonParams}
		/>
	);

	if (loading || !user || !me || user.id === me.id) {
		friendButton = null;
	}

	return friendButton;
}
