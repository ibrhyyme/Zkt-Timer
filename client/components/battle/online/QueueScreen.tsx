import React, {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRight, Sword} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {gqlQueryTyped} from '../../api';
import {BattleMatchHistoryDocument, MyBattleRatingDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {
	BATTLE_PUZZLE,
	CHALLENGE_TTL_SEC,
	INSPECTION_DNF_SEC,
	INSPECTION_SEC,
	QUEUE_QUIET_NOTICE_SEC,
	ROUNDS_TO_WIN,
	SCRAMBLE_SEC,
	SCRAMBLE_TIMEOUT_SEC,
	SOLVE_CUTOFF_SEC,
} from '../../../../shared/battle/config';
import type {QueueStatePayload} from '../../../../shared/battle/events';
import type {BattleCubeInfo} from '../../../../shared/battle/events';
import {avatarSrc} from './OpponentBar';

const b = block('online-battle');

export interface QueueCubeView {
	connected: boolean;
	connecting: boolean;
	reconnecting: boolean;
	deviceName: string | null;
	battery: number | null;
	info: BattleCubeInfo | null;
	connect(): void;
}

interface Props {
	searching: boolean;
	queue: QueueStatePayload | null;
	cube: QueueCubeView;
	onSearch(): void;
	onStop(): void;
	onStillHere(): void;
	/** A profile's "Challenge": this player's name, the stage offers the challenge instead. */
	duelTarget?: string | null;
	/** Opens a duel invite: a link, or the challenge to duelTarget. */
	onChallenge?(): void;
	/** Drops duelTarget (back to the plain queue screen). */
	onClearTarget?(): void;
	/** Development preview: this profile instead of the signed-in user's. */
	preview?: QueuePreviewProfile;
}

export interface QueuePreviewProfile {
	name: string;
	avatar: string | null;
	rating: QueueRating | null;
	recent: RecentMatch[];
}

type MatchResult = 'WIN' | 'LOSS' | 'DRAW';

export interface QueueRating {
	rating: number;
	provisional: boolean;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	peak: number;
	rank: number | null;
}

export interface RecentMatch {
	id: string;
	result: MatchResult;
	scoreFor: number;
	scoreAgainst: number;
	delta: number | null;
	opponentName: string;
	opponentAvatar: string | null;
	/** A duel: labelled, and left out of the rated form strip. */
	challenge?: boolean;
}

/** Matches in the form strip, the "last 10" GAN Cube Station shows on its ranked home. */
const FORM_SIZE = 10;
/** Rows in the recent matches list. */
const RECENT_SIZE = 5;

function formatWait(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Rating change of a past match: "+11", "−9", "±0". */
export function formatDelta(delta: number | null | undefined): string {
	if (delta == null) return '';
	const d = Math.round(delta);
	return d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '±0';
}

function toResult(value: string | null | undefined): MatchResult {
	return value === 'WIN' || value === 'LOSS' ? value : 'DRAW';
}

/**
 * The player's rating and last matches, read once each time the queue screen opens, so a
 * finished match is already counted when the player comes back from the result screen.
 * Both are optional: a failed read just leaves its card out.
 */
function useQueueProfile(userId: string | null): {rating: QueueRating | null; recent: RecentMatch[]; loaded: boolean} {
	const [state, setState] = useState<{rating: QueueRating | null; recent: RecentMatch[]; loaded: boolean}>({
		rating: null,
		recent: [],
		loaded: false,
	});

	useEffect(() => {
		if (!userId) return;
		let alive = true;
		Promise.all([
			gqlQueryTyped(MyBattleRatingDocument, {puzzle: BATTLE_PUZZLE}, {fetchPolicy: 'no-cache'}).catch(() => null),
			gqlQueryTyped(BattleMatchHistoryDocument, {userId, page: 0}, {fetchPolicy: 'no-cache'}).catch(() => null),
		]).then(([ratingRes, historyRes]) => {
			if (!alive) return;
			const row = ratingRes?.data?.myBattleRating;
			const items = historyRes?.data?.battleMatchHistory?.items || [];
			setState({
				rating:
					row && row.games > 0
						? {
								rating: Math.round(row.rating),
								provisional: !!row.provisional,
								games: row.games,
								wins: row.wins,
								losses: row.losses,
								draws: row.draws,
								peak: Math.round(row.peak_rating),
								rank: row.rank ?? null,
						  }
						: null,
				recent: items.slice(0, FORM_SIZE).map((m) => ({
					id: m.id,
					result: toResult(m.result),
					scoreFor: m.score_for,
					scoreAgainst: m.score_against,
					delta: m.delta ?? null,
					opponentName: m.opponent?.username || '?',
					opponentAvatar: m.opponent?.pfp_image_url || null,
					challenge: !!m.is_challenge,
				})),
				loaded: true,
			});
		});
		return () => {
			alive = false;
		};
	}, [userId]);

	return state;
}

function Avatar({name, src, size}: {name: string; src: string | null; size: 'lg' | 'sm'}) {
	const url = avatarSrc(src);
	return (
		<span className={b('q-avatar', {[size]: true})} aria-hidden="true">
			{url ? <img src={url} alt="" /> : <span>{(name || '?').charAt(0).toUpperCase()}</span>}
		</span>
	);
}

/**
 * Queue screen (design 5.3, redesigned in the battle UI pass): the search with the cube
 * under it, the player's card, the recent matches and how a match runs.
 *
 * Phone: one column in that order, scrolling. Desktop: the search on the left, the cards
 * beside it. No effects: hierarchy from Archivo and Roboto Mono, state from cube stickers.
 */
export default function QueueScreen(props: Props) {
	const {searching, queue, cube, onSearch, onStop, onStillHere, duelTarget = null, preview} = props;
	const {t} = useTranslation();
	const me = useMe();
	const profile = useQueueProfile(preview ? null : me?.id || null);
	const {rating, recent, loaded} = preview ? {...preview, loaded: true} : profile;
	const startedAtRef = useRef<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	// The local clock runs the display; the server's waitedSec only corrects it.
	//
	// This used to re-anchor on every render. The server sends waitedSec floored to the second
	// and only every few seconds, so between two queue_states each 500 ms tick put the anchor
	// back on the same stale value: the clock stood still, then jumped when the next one came.
	// Now a queue_state is read once, when it arrives, and moves the anchor only when the two
	// disagree by more than the flooring can explain.
	if (!searching) {
		startedAtRef.current = null;
	} else if (startedAtRef.current == null) {
		startedAtRef.current = Date.now() - (queue?.searching ? queue.waitedSec * 1000 : 0);
	}

	useEffect(() => {
		if (!searching || !queue?.searching) return;
		const serverStart = Date.now() - queue.waitedSec * 1000;
		const localStart = startedAtRef.current;
		if (localStart == null || Math.abs(localStart - serverStart) > 1500) {
			startedAtRef.current = serverStart;
		}
	}, [queue]);

	useEffect(() => {
		if (!searching) return;
		const id = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(id);
	}, [searching]);

	const waitedSec = searching && startedAtRef.current != null ? (now - startedAtRef.current) / 1000 : 0;
	const count = queue?.searchingCount ?? 0;
	const supported = !!cube.info?.hasClock;
	const name = preview ? preview.name : me?.username || '';
	const myAvatar = preview ? preview.avatar : me?.profile?.pfp_image?.storage_path || null;

	// ── The action ──
	// One status line in display type, the clock in mono while searching, one button. The
	// earlier round "orb" with its glow, logo watermark and orbiting stickers read as generated
	// decoration; the character now comes from type and the cube's own sticker squares.
	const busy = cube.connecting || cube.reconnecting;
	let status: string;
	let sub: React.ReactNode = null;
	let action: React.ReactNode = null;
	if (searching) {
		status = t('online_battle.searching');
		sub =
			waitedSec >= QUEUE_QUIET_NOTICE_SEC && count <= 1
				? t('online_battle.nobody_searching')
				: count > 0
					? t('online_battle.searching_count', {count})
					: null;
		action = <Button large fullWidth gray text={t('online_battle.stop_searching')} onClick={onStop} />;
	} else if (!cube.connected) {
		status = cube.reconnecting ? t('online_battle.cube_reconnecting') : t('online_battle.cube_not_connected');
		sub = t('online_battle.queue.cube_hint');
		action = (
			<Button
				large
				fullWidth
				primary
				loading={busy}
				disabled={busy}
				text={cube.connecting ? t('online_battle.queue.connecting') : t('online_battle.connect_cube')}
				onClick={() => cube.connect()}
			/>
		);
	} else if (!supported) {
		status = t('online_battle.cube_not_supported');
		sub = t('online_battle.supported_cubes');
	} else if (duelTarget) {
		status = duelTarget;
		sub = t('online_battle.duel.target_sub', {minutes: CHALLENGE_TTL_SEC / 60});
		action = (
			<Button
				large
				fullWidth
				primary
				iconFirst
				icon={<Sword weight="bold" />}
				text={t('online_battle.duel.send_challenge')}
				onClick={props.onChallenge}
			/>
		);
	} else {
		status = t('online_battle.ready_title');
		action = (
			<>
				<Button large fullWidth primary text={t('online_battle.find_opponent')} onClick={onSearch} />
				{props.onChallenge && (
					<>
						<Button
							large
							fullWidth
							gray
							iconFirst
							icon={<Sword weight="bold" />}
							text={t('online_battle.duel.invite_friend')}
							onClick={props.onChallenge}
						/>
						<p className={b('stage-note')}>
							{t('online_battle.duel.invite_friend_note', {minutes: CHALLENGE_TTL_SEC / 60})}
						</p>
					</>
				)}
			</>
		);
	}

	const cubeRow = cube.connected ? (
		<div className={b('cube-row')}>
			<span className={b('sticker', {green: supported, orange: !supported})} aria-hidden="true" />
			<span className={b('cube-name')}>{cube.deviceName || t('online_battle.cube')}</span>
			{cube.battery != null && (
				<span className={b('cube-battery')} lang="en">
					{cube.battery}%
				</span>
			)}
		</div>
	) : null;

	const stage = (
		<section className={b('stage', {searching})} aria-live="polite">
			{duelTarget ? (
				<span className={b('eyebrow')}>
					<span className={b('sticker', {blue: true})} aria-hidden="true" />
					{t('online_battle.duel.target_eyebrow')}
				</span>
			) : (
				<span className={b('eyebrow')}>3x3 · {t('online_battle.smart_cube_tag')}</span>
			)}
			<h2 className={b('stage-title', {name: !!duelTarget && cube.connected && supported})}>{status}</h2>
			{searching && (
				<div className={b('stage-clock')} lang="en">
					{formatWait(waitedSec)}
				</div>
			)}
			{sub && <p className={b('stage-sub')}>{sub}</p>}
			{action && <div className={b('stage-action')}>{action}</div>}
			{cubeRow}
			{duelTarget && props.onClearTarget && (
				<button type="button" className={b('me-link')} onClick={props.onClearTarget}>
					{t('online_battle.duel.target_cancel')}
				</button>
			)}
		</section>
	);

	// ── Player card ──
	// The form strip is the rated record; duels are only in the recent list.
	const form = recent
		.filter((m) => !m.challenge)
		.slice(0, FORM_SIZE)
		.reverse();
	const stats: [string, number][] = rating
		? [
				['stat_wins', rating.wins],
				['stat_losses', rating.losses],
				['stat_draws', rating.draws],
				['stat_peak', rating.peak],
		  ]
		: [];
	const meCard = (
		<section className={b('q-card')}>
			<div className={b('me-head')}>
				<Avatar name={name} src={myAvatar} size="lg" />
				<span className={b('me-name')}>{name}</span>
				{rating?.rank != null && (
					<span className={b('me-rank')} lang="en">
						#{rating.rank}
					</span>
				)}
			</div>

			{rating ? (
				<>
					<div className={b('me-rating')}>
						<span className={b('me-rating-value')} lang="en">
							{rating.rating}
						</span>
						<span className={b('eyebrow')} lang="en">
							{t('online_battle.rating')}
							{rating.provisional && (
								<span className={b('provisional')} title={t('online_battle.provisional')}>
									?
								</span>
							)}
						</span>
					</div>
					<dl className={b('me-stats')}>
						{stats.map(([key, value]) => (
							<div key={key} className={b('me-stat')}>
								<dt className={b('eyebrow')}>{t(`online_battle.queue.${key}`)}</dt>
								<dd className={b('me-stat-value')} lang="en">
									{value}
								</dd>
							</div>
						))}
					</dl>
					{form.length >= 2 && (
						<div className={b('form')}>
							<span className={b('eyebrow')}>{t('online_battle.queue.last_n', {count: form.length})}</span>
							<span className={b('stickers')}>
								{form.map((m) => (
									<span key={m.id} className={b('sticker', {green: m.result === 'WIN', red: m.result === 'LOSS'})} />
								))}
							</span>
						</div>
					)}
				</>
			) : loaded ? (
				<div className={b('me-first')}>
					<strong>{t('battle_landing.first_match')}</strong>
					<span>{t('online_battle.queue.first_body')}</span>
				</div>
			) : null}

			<Link to="/ranks" className={b('me-link')}>
				{t('online_battle.queue.ranks_link')}
				<ArrowRight weight="bold" />
			</Link>
		</section>
	);

	// ── Recent matches ──
	const recentCard = recent.length ? (
		<section className={b('q-card')}>
			<h2 className={b('eyebrow')}>{t('online_battle.queue.recent_title')}</h2>
			<ul className={b('recent')}>
				{recent.slice(0, RECENT_SIZE).map((m) => (
					<li key={m.id} className={b('recent-row')}>
						<span
							className={b('sticker', {green: m.result === 'WIN', red: m.result === 'LOSS'})}
							title={
								m.result === 'WIN'
									? t('online_battle.you_won')
									: m.result === 'LOSS'
										? t('online_battle.you_lost')
										: t('online_battle.match_draw')
							}
						/>
						<span className={b('recent-name')}>{m.opponentName}</span>
						<span className={b('recent-score')} lang="en">
							{m.scoreFor}–{m.scoreAgainst}
						</span>
						{m.challenge ? (
							<span className={b('recent-tag')}>{t('online_battle.duel.history_tag')}</span>
						) : (
							<span className={b('recent-delta')} lang="en">
								{formatDelta(m.delta)}
							</span>
						)}
					</li>
				))}
			</ul>
		</section>
	) : null;

	// ── The rules, with their numbers from shared/battle/config ──
	// Real numbers instead of prose: a rule change in config shows here without a text edit.
	const rules: {key: string; value: string; note: string}[] = [
		{
			key: 'scramble',
			value: t('online_battle.rules.seconds', {seconds: SCRAMBLE_SEC}),
			note: t('online_battle.rules.late_note', {seconds: SCRAMBLE_TIMEOUT_SEC}),
		},
		{
			key: 'inspection',
			value: t('online_battle.rules.seconds', {seconds: INSPECTION_SEC}),
			note: t('online_battle.rules.late_note', {seconds: INSPECTION_DNF_SEC}),
		},
		{
			key: 'cutoff',
			value: t('online_battle.rules.seconds', {seconds: SOLVE_CUTOFF_SEC}),
			note: t('online_battle.rules.cutoff_note'),
		},
		{
			key: 'match',
			value: t('online_battle.first_to', {n: ROUNDS_TO_WIN}),
			note: t('online_battle.rules.match_note'),
		},
	];
	const howCard = (
		<section className={b('q-card')}>
			<h2 className={b('eyebrow')}>{t('online_battle.rules.title')}</h2>
			<dl className={b('rules')}>
				{rules.map((r) => (
					<div key={r.key} className={b('rule')}>
						<dt className={b('rule-name')}>{t(`online_battle.rules.${r.key}`)}</dt>
						<dd className={b('rule-value')}>{r.value}</dd>
						<dd className={b('rule-note')}>{r.note}</dd>
					</div>
				))}
			</dl>
			<p className={b('rules-foot')}>{t('online_battle.rules.stack_note')}</p>
		</section>
	);

	return (
		<div className={b('queue')}>
			<div className={b('q-stage')}>{stage}</div>
			<div className={b('q-me')}>{meCard}</div>
			{recentCard && <div className={b('q-recent')}>{recentCard}</div>}
			<div className={b('q-how')}>{howCard}</div>

			{searching && queue?.askStillHere && (
				<div className={b('dialog-backdrop')}>
					<div className={b('dialog')} role="dialog">
						<p className={b('dialog-text')}>{t('online_battle.still_here_title')}</p>
						<div className={b('dialog-actions')}>
							<Button gray text={t('online_battle.stop_searching')} onClick={onStop} />
							<Button primary text={t('online_battle.still_here_yes')} onClick={onStillHere} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
