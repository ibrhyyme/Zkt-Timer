import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowRight} from 'phosphor-react';
import block from '../../../styles/bem';
import {gqlQueryTyped} from '../../api';
import {BattleMatchHistoryDocument} from '../../../@types/generated/graphql';
import {avatarSrc} from '../../battle/online/OpponentBar';
import {
	formatDelta,
	FORM_SIZE,
	QueueRating,
	RECENT_SIZE,
	RecentMatch,
	toRecentMatch,
} from '../../battle/online/QueueScreen';
import './BattleProfile.scss';

const b = block('battle-player');

interface Props {
	userId: string;
	username: string;
	/** Storage path of the profile picture. */
	avatar: string | null;
	rating: QueueRating;
	/** From the Modal frame. */
	onClose?: () => void;
}

export function BattleAvatar({name, src, className}: {name: string; src: string | null; className?: string}) {
	const url = avatarSrc(src);
	return (
		<span className={className} aria-hidden="true">
			{url ? <img src={url} alt="" /> : <span>{(name || '?').charAt(0).toUpperCase()}</span>}
		</span>
	);
}

/**
 * A player's Online Battle record, opened from the profile card: rating and place, wins, losses,
 * draws and peak, and the last matches from their side. The list keeps the room of a full one
 * while it loads and when it is short, so the modal is one size for every player.
 */
export default function BattlePlayerModal({userId, username, avatar, rating, onClose}: Props) {
	const {t} = useTranslation();
	const [recent, setRecent] = useState<RecentMatch[] | null>(null);

	useEffect(() => {
		let alive = true;
		gqlQueryTyped(BattleMatchHistoryDocument, {userId, page: 0}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (!alive) return;
				const items = res?.data?.battleMatchHistory?.items || [];
				setRecent(items.slice(0, FORM_SIZE).map(toRecentMatch));
			})
			.catch(() => {
				// The list is optional; a failed read leaves its room empty rather than saying
				// "no matches" about a player who has some.
			});
		return () => {
			alive = false;
		};
	}, [userId]);

	// The form strip is the rated record, oldest on the left; duels are only in the list.
	const form = (recent || [])
		.filter((m) => !m.challenge)
		.slice(0, FORM_SIZE)
		.reverse();
	const stats: [string, number][] = [
		['stat_wins', rating.wins],
		['stat_losses', rating.losses],
		['stat_draws', rating.draws],
		['stat_peak', rating.peak],
	];

	return (
		<div className={b()}>
			<div className={b('head')}>
				<BattleAvatar name={username} src={avatar} className={b('avatar')} />
				<span className={b('name')}>{username}</span>
				{rating.rank != null && (
					<span className={b('rank')} lang="en">
						#{rating.rank}
					</span>
				)}
			</div>

			<div className={b('rating')}>
				<span className={b('rating-value')} lang="en">
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
			{rating.provisional && <p className={b('note')}>{t('ranks.provisional_hint')}</p>}

			<dl className={b('stats')}>
				{stats.map(([key, value]) => (
					<div key={key} className={b('stat')}>
						<dt className={b('eyebrow')}>{t(`online_battle.queue.${key}`)}</dt>
						<dd className={b('stat-value')} lang="en">
							{value}
						</dd>
					</div>
				))}
			</dl>

			<section className={b('recent')}>
				<div className={b('recent-head')}>
					<h3 className={b('eyebrow')}>{t('online_battle.queue.recent_title')}</h3>
					{form.length >= 2 && (
						<span
							className={b('stickers')}
							title={t('online_battle.queue.last_n', {count: form.length})}
						>
							{form.map((m) => (
								<span key={m.id} className={b('sticker', {green: m.result === 'WIN', red: m.result === 'LOSS'})} />
							))}
						</span>
					)}
				</div>
				<ul className={b('list')}>
					{recent && !recent.length && <li className={b('empty')}>{t('online_battle.profile.no_matches')}</li>}
					{(recent || []).slice(0, RECENT_SIZE).map((m) => (
						<li key={m.id} className={b('row')}>
							<span
								className={b('sticker', {green: m.result === 'WIN', red: m.result === 'LOSS'})}
								title={
									m.result === 'WIN'
										? t('online_battle.queue.stat_wins')
										: m.result === 'LOSS'
											? t('online_battle.queue.stat_losses')
											: t('online_battle.queue.stat_draws')
								}
							/>
							<span className={b('row-name')}>{m.opponentName}</span>
							<span className={b('row-score')} lang="en">
								{m.scoreFor}–{m.scoreAgainst}
							</span>
							{m.challenge ? (
								<span className={b('row-tag')}>{t('online_battle.duel.history_tag')}</span>
							) : (
								<span className={b('row-delta')} lang="en">
									{formatDelta(m.delta)}
								</span>
							)}
						</li>
					))}
				</ul>
			</section>

			<Link to="/ranks" className={b('link')} onClick={() => onClose?.()}>
				{t('online_battle.queue.ranks_link')}
				<ArrowRight weight="bold" />
			</Link>
		</div>
	);
}
