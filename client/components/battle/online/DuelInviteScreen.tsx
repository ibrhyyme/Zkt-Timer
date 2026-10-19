import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {ROUNDS_TO_WIN} from '../../../../shared/battle/config';
import type {BattleChallengeStatus, BattleHeadToHead} from '../../../../shared/battle/types';
import {avatarSrc} from './OpponentBar';
import {formatCountdown} from './DuelWaitScreen';
import type {QueueCubeView} from './QueueScreen';

const b = block('online-battle');

/** What the invite page knows about one invite (GraphQL battleChallenge, local clock). */
export interface DuelInvite {
	code: string;
	status: BattleChallengeStatus;
	/** Local clock. */
	expiresAt: number;
	from: {id: string | null; username: string; avatar: string | null};
	restricted: boolean;
	own: boolean;
	forYou: boolean;
}

/** A battleHeadToHead row (generated types: every field optional) as the score, or null. */
export function toHeadToHead(raw: {wins?: number | null; losses?: number | null; draws?: number | null} | null | undefined): BattleHeadToHead | null {
	if (!raw) return null;
	return {wins: raw.wins ?? 0, losses: raw.losses ?? 0, draws: raw.draws ?? 0};
}

/** Why the invite cannot be accepted by this viewer, as an i18n key; null when it can. */
export function duelBlockedKey(invite: DuelInvite | null, now: number): string | null {
	if (!invite) return 'online_battle.duel.status_not_found';
	if (invite.own) return 'online_battle.duel.status_own';
	if (invite.status === 'ACCEPTED') return 'online_battle.duel.status_used';
	if (invite.status === 'CANCELLED') return 'online_battle.duel.status_cancelled';
	if (invite.status === 'EXPIRED' || invite.expiresAt <= now) return 'online_battle.duel.status_expired';
	if (invite.restricted && !invite.forYou) return 'online_battle.duel.status_not_for_you';
	return null;
}

interface Props {
	invite: DuelInvite | null;
	loading: boolean;
	headToHead: BattleHeadToHead | null;
	/** Signed out: the invite shows, accepting asks for an account. */
	signedIn: boolean;
	emailVerified: boolean;
	accepting: boolean;
	cube: QueueCubeView;
	onAccept(): void;
	onGoBattle(): void;
	onSignIn(): void;
	onSignUp(): void;
	onVerifyEmail(): void;
}

/**
 * /duel/<code>: who invites, what it is (unrated, first to three, the time left), the score
 * between the two so far, and the one step left to take: sign in, verify the email, connect
 * the cube, or accept. An invite that cannot be taken says why in one line.
 */
export default function DuelInviteScreen(props: Props) {
	const {invite, loading, headToHead, signedIn, emailVerified, accepting, cube} = props;
	const {t} = useTranslation();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(id);
	}, []);

	if (loading && !invite) {
		return (
			<div className={b('duel')}>
				<section className={b('duel-panel')}>
					<span className={b('eyebrow')}>{t('online_battle.duel.page_title')}</span>
				</section>
			</div>
		);
	}

	const blocked = duelBlockedKey(invite, now);
	const name = invite?.from.username || '?';
	const src = avatarSrc(invite?.from.avatar || null);
	const played = headToHead ? headToHead.wins + headToHead.losses + headToHead.draws : 0;

	let step: React.ReactNode;
	if (blocked) {
		step = (
			<>
				<p className={b('duel-status')}>{t(blocked)}</p>
				<Button large fullWidth gray text={t('online_battle.duel.go_battle')} onClick={props.onGoBattle} />
			</>
		);
	} else if (!signedIn) {
		step = (
			<>
				<p className={b('duel-status')}>
					<strong>{t('online_battle.duel.sign_in_title')}</strong>
					<span>{t('online_battle.duel.sign_in_body')}</span>
				</p>
				<Button large fullWidth primary text={t('online_battle.duel.sign_in')} onClick={props.onSignIn} />
				<Button large fullWidth gray text={t('online_battle.duel.sign_up')} onClick={props.onSignUp} />
			</>
		);
	} else if (!emailVerified) {
		step = (
			<>
				<p className={b('duel-status')}>
					<strong>{t('online_battle.email_title')}</strong>
					<span>{t('online_battle.email_body')}</span>
				</p>
				<Button large fullWidth primary text={t('online_battle.email_cta')} onClick={props.onVerifyEmail} />
			</>
		);
	} else if (!cube.connected) {
		const busy = cube.connecting || cube.reconnecting;
		step = (
			<>
				<p className={b('duel-status')}>
					<strong>{cube.reconnecting ? t('online_battle.cube_reconnecting') : t('online_battle.cube_not_connected')}</strong>
					<span>{t('online_battle.queue.cube_hint')}</span>
				</p>
				<Button
					large
					fullWidth
					primary
					loading={busy}
					disabled={busy}
					text={cube.connecting ? t('online_battle.queue.connecting') : t('online_battle.connect_cube')}
					onClick={() => cube.connect()}
				/>
			</>
		);
	} else if (!cube.info?.hasClock) {
		step = (
			<p className={b('duel-status')}>
				<strong>{t('online_battle.cube_not_supported')}</strong>
				<span>{t('online_battle.supported_cubes')}</span>
			</p>
		);
	} else {
		step = (
			<Button
				large
				fullWidth
				primary
				loading={accepting}
				disabled={accepting}
				text={accepting ? t('online_battle.duel.accepting') : t('online_battle.duel.accept')}
				onClick={props.onAccept}
			/>
		);
	}

	return (
		<div className={b('duel')}>
			<section className={b('duel-panel')} aria-live="polite">
				<span className={b('eyebrow')}>
					<span className={b('sticker', {blue: true})} aria-hidden="true" />
					{t('online_battle.duel.page_title')}
				</span>

				<div className={b('duel-host')}>
					<span className={b('q-avatar', {lg: true})} aria-hidden="true">
						{src ? <img src={src} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
					</span>
					<h2 className={b('duel-title')}>{t('online_battle.duel.invite_title', {name})}</h2>
				</div>

				{invite && !blocked && (
					<div className={b('duel-meta')}>
						<span>{t('online_battle.duel.unrated')}</span>
						<span>{t('online_battle.first_to', {n: ROUNDS_TO_WIN})}</span>
						<span lang="en">{t('online_battle.duel.time_left_value', {time: formatCountdown(invite.expiresAt - now)})}</span>
					</div>
				)}

				{headToHead && played > 0 && (
					<div className={b('duel-h2h')}>
						<span className={b('eyebrow')}>{t('online_battle.duel.h2h_title')}</span>
						<HeadToHeadScore you={t('online_battle.you')} opponent={name} score={headToHead} />
					</div>
				)}

				<div className={b('duel-actions')}>{step}</div>

				{signedIn && !blocked && cube.connected && (
					<div className={b('cube-row')}>
						<span className={b('sticker', {green: !!cube.info?.hasClock, orange: !cube.info?.hasClock})} aria-hidden="true" />
						<span className={b('cube-name')}>{cube.deviceName || t('online_battle.cube')}</span>
						{cube.battery != null && (
							<span className={b('cube-battery')} lang="en">
								{cube.battery}%
							</span>
						)}
					</div>
				)}
			</section>
			<p className={b('duel-rules')}>{t('online_battle.duel.rules', {n: ROUNDS_TO_WIN})}</p>
		</div>
	);
}

/** "You 7 – 4 ahmet", with the drawn count under it when there are any. */
export function HeadToHeadScore({you, opponent, score}: {you: string; opponent: string; score: BattleHeadToHead}) {
	const {t} = useTranslation();
	return (
		<div className={b('h2h')}>
			<div className={b('h2h-line')}>
				<span className={b('h2h-name')}>{you}</span>
				<span className={b('h2h-score')} lang="en">
					{score.wins}
					<span className={b('board-colon')}>–</span>
					{score.losses}
				</span>
				<span className={b('h2h-name', {end: true})}>{opponent}</span>
			</div>
			{score.draws > 0 && <span className={b('h2h-draws')}>{t('online_battle.duel.h2h_draws', {count: score.draws})}</span>}
		</div>
	);
}
