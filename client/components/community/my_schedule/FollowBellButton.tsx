import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Bell, BellRinging} from 'phosphor-react';
import {gqlMutateTyped} from '../../api';
import {
	FollowCompetitorDocument,
	UnfollowCompetitorDocument,
} from '../../../@types/generated/graphql';
import {openProOnlyModal} from '../../common/pro_only/openProOnlyModal';
import {useMe} from '../../../util/hooks/useMe';
import {isPro} from '../../../lib/pro';
import {toastError, toastSuccess} from '../../../util/toast';
import {useCompetitionData} from './CompetitionLoader';
import {Consts} from '../../../../shared/consts';
import {b} from './shared';

interface Props {
	competitionId: string;
	registrantId: number;
	wcaId?: string | null;
	name: string;
	size?: 'sm' | 'md' | 'lg';
	withLabel?: boolean;
}

export default function FollowBellButton({
	competitionId,
	registrantId,
	wcaId,
	name,
	size = 'sm',
	withLabel = false,
}: Props) {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const {follows, refetchFollows, isFinished} = useCompetitionData();
	const [busy, setBusy] = useState(false);

	// Yarisma bitti — yeni bildirim gelmez, bell anlamsiz
	if (isFinished) return null;

	const isFollowing = follows.some((f) => f.followed_registrant_id === registrantId);
	const followEntry = follows.find((f) => f.followed_registrant_id === registrantId);
	const iconSize = size === 'lg' ? 22 : size === 'md' ? 18 : 16;

	const handleClick = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (busy) return;

		// Free user → Pro modal
		if (!me || !isPro(me)) {
			openProOnlyModal(dispatch, t, 'competition_follow');
			return;
		}

		setBusy(true);
		try {
			if (isFollowing && followEntry) {
				await gqlMutateTyped(UnfollowCompetitorDocument, {id: followEntry.id});
				toastSuccess(t('my_schedule.unfollow_success', {name}));
				await refetchFollows();
			} else {
				if (follows.length >= Consts.MAX_COMPETITION_FOLLOWS) {
					toastError(
						t('my_schedule.follow_limit_reached', {max: Consts.MAX_COMPETITION_FOLLOWS}),
					);
					return;
				}
				const res = await gqlMutateTyped(FollowCompetitorDocument, {
					input: {
						competition_id: competitionId,
						registrant_id: registrantId,
						wca_id: wcaId || undefined,
						name,
					},
				});
				if (res.errors && res.errors.length > 0) {
					const msg = res.errors[0].message || '';
					if (msg.toLowerCase().includes('cannot follow yourself')) {
						toastError(t('my_schedule.follow_self_error'));
					} else if (msg.toLowerCase().includes('max')) {
						toastError(
							t('my_schedule.follow_limit_reached', {max: Consts.MAX_COMPETITION_FOLLOWS}),
						);
					} else {
						toastError(msg);
					}
					return;
				}
				toastSuccess(t('my_schedule.follow_success', {name}));
				await refetchFollows();
			}
		} catch (err: any) {
			const msg: string = err?.message || '';
			if (msg.toLowerCase().includes('cannot follow yourself')) {
				toastError(t('my_schedule.follow_self_error'));
			} else if (msg.toLowerCase().includes('max')) {
				toastError(
					t('my_schedule.follow_limit_reached', {max: Consts.MAX_COMPETITION_FOLLOWS}),
				);
			} else {
				toastError(msg || t('my_schedule.follow_error_generic'));
			}
		} finally {
			setBusy(false);
		}
	};

	const title = isFollowing
		? t('my_schedule.unfollow_competitor')
		: t('my_schedule.follow_competitor');

	return (
		<button
			type="button"
			className={b('follow-bell', {active: isFollowing, large: size === 'lg'})}
			onClick={handleClick}
			disabled={busy}
			aria-label={title}
			title={title}
		>
			{isFollowing ? (
				<BellRinging size={iconSize} weight="fill" />
			) : (
				<Bell size={iconSize} weight="regular" />
			)}
			{withLabel && (
				<span className={b('follow-bell-label')}>
					{isFollowing ? t('my_schedule.following') : t('my_schedule.follow_competitor')}
				</span>
			)}
		</button>
	);
}
