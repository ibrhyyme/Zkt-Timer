import React, {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useParams} from 'react-router-dom';
import block from '../../../styles/bem';
import FeatureGuard from '../../common/page_disabled/FeatureGuard';
import OfflineGuard from '../../common/offline_guard/OfflineGuard';
import BottomSheetNav from '../../layout/nav/bottom_sheet_nav/BottomSheetNav';
import TrainerModeHeader from '../../trainer/common/TrainerModeHeader';
import {gqlQueryTyped} from '../../api';
import {BattleChallengeDocument, BattleChallengeQuery, BattleHeadToHeadDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {challengePath} from '../../../../shared/battle/challenge';
import type {BattleChallengeStatus, BattleHeadToHead} from '../../../../shared/battle/types';
import {DuelPageInvite, OnlineBattleInner} from './OnlineBattle';
import DuelInviteScreen, {DuelInvite, toHeadToHead} from './DuelInviteScreen';
import type {QueueCubeView} from './QueueScreen';
import './OnlineBattle.scss';

const b = block('online-battle');

const STATUSES: readonly BattleChallengeStatus[] = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'];

export function toDuelInvite(c: BattleChallengeQuery['battleChallenge'] | null | undefined): DuelInvite | null {
	if (!c) return null;
	const status = (STATUSES as readonly string[]).includes(c.status) ? (c.status as BattleChallengeStatus) : 'CANCELLED';
	return {
		code: c.code,
		status,
		expiresAt: new Date(c.expires_at).getTime(),
		from: {id: c.from?.id || null, username: c.from?.username || '?', avatar: c.from?.pfp_image_url || null},
		restricted: !!c.restricted,
		own: !!c.own,
		forYou: !!c.for_you,
	};
}

/** The invite and, for a signed-in viewer, the score between the two so far. */
function useDuelInvite(code: string, signedIn: boolean): DuelPageInvite {
	const [state, setState] = useState<{invite: DuelInvite | null; loading: boolean; headToHead: BattleHeadToHead | null}>({
		invite: null,
		loading: true,
		headToHead: null,
	});
	const [nonce, setNonce] = useState(0);

	useEffect(() => {
		let alive = true;
		setState((s) => ({...s, loading: true}));
		(async () => {
			const res = await gqlQueryTyped(BattleChallengeDocument, {code}, {fetchPolicy: 'no-cache'}).catch(() => null);
			const invite = toDuelInvite(res?.data?.battleChallenge);
			let headToHead: BattleHeadToHead | null = null;
			if (signedIn && invite?.from.id && !invite.own) {
				const h = await gqlQueryTyped(BattleHeadToHeadDocument, {userId: invite.from.id}, {fetchPolicy: 'no-cache'}).catch(
					() => null
				);
				headToHead = toHeadToHead(h?.data?.battleHeadToHead);
			}
			if (alive) setState({invite, loading: false, headToHead});
		})();
		return () => {
			alive = false;
		};
	}, [code, signedIn, nonce]);

	const reload = useCallback(() => setNonce((n) => n + 1), []);
	return {code, ...state, reload};
}

/** Signed out there is no cube to drive; the invite screen asks for an account first anyway. */
const NO_CUBE: QueueCubeView = {
	connected: false,
	connecting: false,
	reconnecting: false,
	deviceName: null,
	battery: null,
	info: null,
	connect: () => undefined,
};

/**
 * /duel/<code>: a duel invite (owner decision 2026-10-20). Open to visitors, so whoever got the
 * link sees who invites them before signing in; accepting needs an account, a verified email
 * and a cube with its own clock. Signed in and verified, the page is the Online Battle screen
 * itself (OnlineBattleInner) with the invite in the queue's place, so the duel, its result and
 * its rematch play right here.
 *
 * Client only like /battle/online: the link preview's head tags come from duel_ssr.ts.
 */
export default function DuelPage() {
	const {code} = useParams<{code: string}>();
	if (typeof window === 'undefined') return null;

	return (
		<FeatureGuard feature="online_battle_enabled" pageNameKey="online_battle.duel.page_title">
			<OfflineGuard>
				<DuelPageBody code={code || ''} />
			</OfflineGuard>
		</FeatureGuard>
	);
}

function DuelPageBody({code}: {code: string}) {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const duel = useDuelInvite(code, !!me);

	if (me && me.email_verified) return <OnlineBattleInner duel={duel} />;

	const back = encodeURIComponent(challengePath(code));
	return (
		<div className={b()}>
			<TrainerModeHeader
				onBack={() => history.push('/battle')}
				trail={[{label: t('nav.battle'), onClick: () => history.push('/battle')}, {label: t('online_battle.duel.page_title')}]}
			/>
			<div className={b('body')}>
				<DuelInviteScreen
					invite={duel.invite}
					loading={duel.loading}
					headToHead={duel.headToHead}
					signedIn={!!me}
					emailVerified={!!me?.email_verified}
					accepting={false}
					cube={NO_CUBE}
					onAccept={() => undefined}
					onGoBattle={() => history.push('/battle')}
					onSignIn={() => {
						window.location.href = `/login?redirect=${back}`;
					}}
					onSignUp={() => {
						window.location.href = `/signup?redirect=${back}`;
					}}
					onVerifyEmail={() => history.push('/account/personal-info')}
				/>
			</div>
			<BottomSheetNav />
		</div>
	);
}
