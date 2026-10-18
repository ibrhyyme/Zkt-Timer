import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Flag, MagnifyingGlass, SignOut} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {PROVISIONAL_TYPICAL_GAMES} from '../../../../shared/battle/config';
import type {BattlePlayerInfo, MatchResultPayload, RematchStatePayload} from '../../../../shared/battle/events';
import type {BattleEndReason, BattleSide} from '../../../../shared/battle/types';
import {avatarSrc, formatBattleTime} from './OpponentBar';
import {otherSide, outcomeFor, RoundOutcome, sideScore, sideSolve} from './battle_state';

const b = block('online-battle');

/** Longest report text the dialog accepts. */
export const REPORT_REASON_MAX = 300;

/** Final score from the rounds: the last round result carries the running score. */
export function finalScore(result: MatchResultPayload): {a: number; b: number} {
	const last = result.rounds[result.rounds.length - 1];
	return last ? last.score : {a: 0, b: 0};
}

/** i18n key of the line under the headline when the match did not end on the board. */
export function endReasonKey(reason: BattleEndReason, outcome: RoundOutcome): string | null {
	const mine = outcome === 'lost';
	switch (reason) {
		case 'FORFEIT':
			return mine ? 'online_battle.end.you_gave_up' : 'online_battle.end.opponent_gave_up';
		case 'DISCONNECT':
			return mine ? 'online_battle.end.you_disconnected' : 'online_battle.end.opponent_disconnected';
		case 'ABANDON':
			return mine ? 'online_battle.end.you_left' : 'online_battle.end.opponent_left';
		case 'SERVER_RESTART':
			return 'online_battle.cancelled.server_restart';
		default:
			return null;
	}
}

export type RematchButtonState = 'open' | 'waiting' | 'asked' | 'gone';

/** What the rematch button says and whether it can be pressed (design 5.5). */
export function rematchButtonState(rematch: RematchStatePayload | null, expired: boolean): RematchButtonState {
	if (rematch?.opponent === 'left') return 'gone';
	if (rematch?.you && rematch.opponent === true) return 'waiting';
	if (expired) return 'gone';
	if (rematch?.you) return 'waiting';
	if (rematch?.opponent === true) return 'asked';
	return 'open';
}

interface Props {
	result: MatchResultPayload;
	side: BattleSide;
	/** This player, for the left side of the scoreboard. */
	myName: string;
	myAvatar: string | null;
	/** This player's rating going into the match; shown when the match changed nothing. */
	myRating: number;
	/** The opponent as matched: name, picture, rating before the match. */
	opponent: BattlePlayerInfo;
	rematch: RematchStatePayload | null;
	/** Local clock: the rematch window closes. */
	rematchDeadlineLocal: number;
	reported: boolean;
	onRematch(): void;
	onNewOpponent(): void;
	onExit(): void;
	onReport(reason: string): void;
}

/** One side of the scoreboard: picture, name, rating; a green sticker marks the winner. */
function Side({name, avatar, rating, winner, end}: {name: string; avatar: string | null; rating: number | null; winner: boolean; end?: boolean}) {
	const src = avatarSrc(avatar);
	return (
		<div className={b('vs-side', {end: !!end})}>
			<span className={b('q-avatar', {lg: true})} aria-hidden="true">
				{src ? <img src={src} alt="" /> : <span>{(name || '?').charAt(0).toUpperCase()}</span>}
			</span>
			<span className={b('vs-name')}>
				{winner && <span className={b('sticker', {green: true})} aria-hidden="true" />}
				<span className={b('vs-name-text')}>{name}</span>
			</span>
			{rating != null && (
				<span className={b('vs-rating')} lang="en">
					{rating}
				</span>
			)}
		</div>
	);
}

/**
 * Match result, rating change and the rematch window (design 5.5).
 *
 * The two players face each other across the score, the rounds and the rating each get a
 * card, and the rematch is the one filled button. No crown, no glow, no coloured headline:
 * the outcome is the sticker in front of the headline, the numbers are mono.
 *
 * The opponent's side shows the rating they came in with: the result carries only this
 * player's change, and Glicko-2 is not zero-sum, so their new number cannot be derived here.
 */
export default function ResultScreen(props: Props) {
	const {result, side, myName, myAvatar, myRating, opponent, rematch, rematchDeadlineLocal, reported} = props;
	const {t} = useTranslation();
	const [now, setNow] = useState(() => Date.now());
	const [reportOpen, setReportOpen] = useState(false);
	const [reason, setReason] = useState('');

	const secondsLeft = Math.max(0, Math.ceil((rematchDeadlineLocal - now) / 1000));
	const expired = secondsLeft <= 0;

	useEffect(() => {
		if (expired) return;
		const id = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(id);
	}, [expired]);

	const opp = otherSide(side);
	const outcome = outcomeFor(result.winner, side);
	const score = finalScore(result);
	const endKey = endReasonKey(result.endReason, outcome);

	const headline =
		outcome === 'won' ? t('online_battle.you_won') : outcome === 'lost' ? t('online_battle.you_lost') : t('online_battle.match_draw');

	const rematchState = rematchButtonState(rematch, expired);
	const rematchRated = rematch ? rematch.rated : result.rated;
	let rematchText: string;
	if (rematchState === 'gone') rematchText = t('online_battle.opponent_left_rematch');
	else if (rematchState === 'waiting') rematchText = t('online_battle.rematch_waiting');
	else {
		const label = rematchRated ? t('online_battle.rematch') : t('online_battle.rematch_unrated');
		rematchText = `${label}  0:${String(secondsLeft).padStart(2, '0')}`;
	}

	const rated = result.rated && result.ratingBefore != null && result.ratingAfter != null && result.delta != null;
	const provisionalGames = Math.min(result.games, PROVISIONAL_TYPICAL_GAMES);

	const sendReport = () => {
		const text = reason.trim();
		if (!text) return;
		props.onReport(text.slice(0, REPORT_REASON_MAX));
		setReportOpen(false);
		setReason('');
	};

	return (
		<div className={b('result')}>
			<header className={b('result-head')}>
				<h2 className={b('result-title')}>
					<span
						className={b('sticker', {big: true, green: outcome === 'won', red: outcome === 'lost'})}
						aria-hidden="true"
					/>
					{headline}
				</h2>
				{endKey && <p className={b('result-reason')}>{t(endKey)}</p>}
			</header>

			<section className={b('q-card')}>
				<div className={b('vs')}>
					<Side name={myName} avatar={myAvatar} rating={rated ? result.ratingAfter : myRating} winner={outcome === 'won'} />
					<div className={b('vs-score')} lang="en">
						{sideScore(score, side)}–{sideScore(score, opp)}
					</div>
					<Side end name={opponent.username} avatar={opponent.avatar} rating={opponent.rating} winner={outcome === 'lost'} />
				</div>
			</section>

			<section className={b('q-card')}>
				<h3 className={b('eyebrow')}>{t('online_battle.result.rounds_title')}</h3>
				{/* Names as written: an uppercased username is a different name (ibrhyme -> İBRHYME). */}
				<div className={b('round-row', {head: true})}>
					<span />
					<span className={b('round-who')}>{t('online_battle.you')}</span>
					<span className={b('round-who', {end: true})}>{opponent.username}</span>
				</div>
				{result.rounds.map((round) => {
					const mine = sideSolve(round, side);
					const theirs = sideSolve(round, opp);
					const roundOutcome = outcomeFor(round.winner, side);
					return (
						<div key={round.round} className={b('round-row')}>
							<span className={b('round-label')} lang="en">
								{String(round.round).padStart(2, '0')}
							</span>
							<span className={b('round-time', {win: roundOutcome === 'won'})} lang="en">
								{roundOutcome === 'won' && <span className={b('sticker', {green: true})} aria-hidden="true" />}
								{formatBattleTime(mine.timeMs, mine.penalty)}
							</span>
							<span className={b('round-time', {win: roundOutcome === 'lost', end: true})} lang="en">
								{formatBattleTime(theirs.timeMs, theirs.penalty)}
								{roundOutcome === 'lost' && <span className={b('sticker', {green: true})} aria-hidden="true" />}
							</span>
							{mine.dnfReason && mine.penalty === 'DNF' && (
								<span className={b('dnf-reason')}>{t(`online_battle.dnf_reason.${mine.dnfReason}`)}</span>
							)}
						</div>
					);
				})}
			</section>

			<section className={b('q-card')}>
				{/* lang="en": "Rating" is an English loanword in Turkish; uppercased under lang="tr" it
				    came out as "RATİNG" with a dotted capital I. */}
				<h3 className={b('eyebrow')} lang="en">
					{t('online_battle.rating')}
				</h3>
				{rated ? (
					<div className={b('rating-change')}>
						<span className={b('rating-numbers')} lang="en">
							{result.ratingBefore} → {result.ratingAfter}
						</span>
						<span className={b('rating-delta')} lang="en">
							{result.delta > 0 ? '+' : result.delta < 0 ? '−' : '±'}
							{Math.abs(result.delta)}
						</span>
					</div>
				) : (
					<div className={b('rating-change')}>{t('online_battle.unrated_match')}</div>
				)}
				{result.provisional && (
					<div className={b('form')}>
						<span className={b('stickers')} aria-hidden="true">
							{Array.from({length: PROVISIONAL_TYPICAL_GAMES}, (_, i) => (
								<span key={i} className={b('sticker', {blue: i < provisionalGames})} />
							))}
						</span>
						<span className={b('eyebrow')}>
							{t('online_battle.provisional_progress', {games: provisionalGames, total: PROVISIONAL_TYPICAL_GAMES})}
						</span>
					</div>
				)}
			</section>

			<div className={b('result-actions')}>
				<Button
					large
					fullWidth
					success={rematchState === 'asked'}
					primary={rematchState !== 'asked'}
					text={rematchText}
					disabled={rematchState === 'gone' || rematchState === 'waiting'}
					onClick={props.onRematch}
				/>
				{rematchState === 'asked' && <div className={b('rematch-asked')}>{t('online_battle.opponent_wants_rematch')}</div>}
				<div className={b('result-row')}>
					<Button
						fullWidth
						outline
						iconFirst
						icon={<MagnifyingGlass weight="bold" />}
						text={t('online_battle.new_opponent')}
						onClick={props.onNewOpponent}
					/>
					<Button fullWidth outline iconFirst icon={<SignOut weight="bold" />} text={t('online_battle.exit')} onClick={props.onExit} />
				</div>
			</div>

			<button type="button" className={b('report-link')} disabled={reported} onClick={() => setReportOpen(true)}>
				<Flag weight="bold" aria-hidden="true" />
				{reported ? t('online_battle.reported') : t('online_battle.report_opponent')}
			</button>

			{reportOpen && (
				<div className={b('dialog-backdrop')}>
					<div className={b('dialog')} role="dialog">
						<p className={b('dialog-text')}>{t('online_battle.report_title')}</p>
						<textarea
							className={b('report-input')}
							value={reason}
							maxLength={REPORT_REASON_MAX}
							rows={3}
							placeholder={t('online_battle.report_placeholder')}
							onChange={(e) => setReason(e.target.value)}
						/>
						<div className={b('dialog-actions')}>
							<Button outline text={t('online_battle.cancel')} onClick={() => setReportOpen(false)} />
							<Button danger text={t('online_battle.report_send')} disabled={!reason.trim()} onClick={sendReport} />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
