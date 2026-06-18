import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Bell, BellRinging} from 'phosphor-react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {openProOnlyModal} from '../../common/pro_only/openProOnlyModal';
import {useMe} from '../../../util/hooks/useMe';
import {isPro} from '../../../lib/pro';
import {toastError, toastSuccess} from '../../../util/toast';
import {Consts} from '../../../../shared/consts';
import {b} from './shared';

// Raw gql (not the generated typed documents) so this component compiles before
// codegen has run on the new ZKT follow operations.
const FOLLOW_MUTATION = gql`
	mutation followZktCompetitor($input: FollowZktCompetitorInput!) {
		followZktCompetitor(input: $input) {
			id
		}
	}
`;

const UNFOLLOW_MUTATION = gql`
	mutation unfollowZktCompetitor($id: String!) {
		unfollowZktCompetitor(id: $id)
	}
`;

interface Props {
	competitionId: string;
	followedUserId?: string | null;
	followedPersonId?: string | null;
	name: string;
	isFollowing: boolean;
	followId?: string | null;
	followCount: number;
	onChanged: () => void;
}

/**
 * "Follow this competitor" bell for ZKT competitions — the WCA FollowBellButton
 * ported to the user/person XOR identity. Pro-gated client-side (free users get
 * the Pro modal); the server mutation re-enforces PRO. Parent owns the follows
 * list and re-fetches via onChanged.
 */
export default function ZktFollowBellButton({
	competitionId,
	followedUserId,
	followedPersonId,
	name,
	isFollowing,
	followId,
	followCount,
	onChanged,
}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const [busy, setBusy] = useState(false);

	const limitMsg = () =>
		t('zkt_comp.follow_limit_reached', {max: Consts.MAX_COMPETITION_FOLLOWS});

	const handleClick = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (busy) return;

		// Free user → Pro upsell (same featureKey as the WCA follow flow)
		if (!me || !isPro(me)) {
			openProOnlyModal(dispatch, t, 'competition_follow');
			return;
		}

		setBusy(true);
		try {
			if (isFollowing && followId) {
				await gqlMutate(UNFOLLOW_MUTATION, {id: followId});
				toastSuccess(t('zkt_comp.unfollow_success', {name}));
				onChanged();
			} else {
				if (followCount >= Consts.MAX_COMPETITION_FOLLOWS) {
					toastError(limitMsg());
					return;
				}
				const res = await gqlMutate(FOLLOW_MUTATION, {
					input: {
						competition_id: competitionId,
						followed_user_id: followedUserId || undefined,
						followed_person_id: followedPersonId || undefined,
						name,
					},
				});
				if (res.errors && res.errors.length > 0) {
					const msg = (res.errors[0].message || '').toLowerCase();
					if (msg.includes('yourself')) toastError(t('zkt_comp.follow_self_error'));
					else if (msg.includes('max')) toastError(limitMsg());
					else toastError(res.errors[0].message);
					return;
				}
				toastSuccess(t('zkt_comp.follow_success', {name}));
				onChanged();
			}
		} catch (err: any) {
			const msg: string = (err?.message || '').toLowerCase();
			if (msg.includes('yourself')) toastError(t('zkt_comp.follow_self_error'));
			else if (msg.includes('max')) toastError(limitMsg());
			else toastError(err?.message || t('zkt_comp.follow_error_generic'));
		} finally {
			setBusy(false);
		}
	};

	const title = isFollowing
		? t('zkt_comp.unfollow_competitor')
		: t('zkt_comp.follow_competitor');

	return (
		<button
			type="button"
			className={b('follow-bell', {active: isFollowing})}
			onClick={handleClick}
			disabled={busy}
			aria-label={title}
			title={title}
		>
			{isFollowing ? (
				<BellRinging size={16} weight="fill" />
			) : (
				<Bell size={16} weight="regular" />
			)}
		</button>
	);
}
