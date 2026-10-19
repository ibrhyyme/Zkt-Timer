import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {useMutation, useQuery} from '@apollo/client';
import {Prohibit, X} from 'phosphor-react';
import block from '../../../styles/bem';
import PageTitle from '../../common/page_title/PageTitle';
import Button from '../../common/button/Button';
import Loading from '../../common/loading/Loading';
import Empty from '../../common/empty/Empty';
import Input from '../../common/inputs/input/Input';
import {getFullFormattedDate} from '../../../util/dates';
import {getTimeString} from '../../../util/time';
import {formatBattleTime} from '../../battle/online/OpponentBar';
import {toastError, toastSuccess} from '../../../util/toast';
import {getGqlErrorMessage} from '../../../util/gql-error';
import {useSiteConfig} from '../../../util/hooks/useSiteConfig';
import {
	AdminFlaggedBattleMatchesDocument,
	AdminFlaggedBattleMatchesQuery,
	AdminVoidBattleMatchDocument,
	BattleMatchDocument,
	BattleMatchQuery,
} from '../../../@types/generated/graphql';
import {
	cleanFlags,
	endReasonLabel,
	flagLabel,
	formatRatingDelta,
	normalizeMatchId,
	parseMoveLog,
	voidMessage,
} from './admin_battle_matches';
import './AdminBattleMatches.scss';

const b = block('admin-battle');

type FlaggedRow = NonNullable<NonNullable<AdminFlaggedBattleMatchesQuery['adminFlaggedBattleMatches']>['items']>[number];
type MatchDetail = NonNullable<BattleMatchQuery['battleMatch']>;
type RoundDetail = NonNullable<NonNullable<MatchDetail['rounds']>[number]>;
type Player = {id?: string | null; username?: string | null} | null | undefined;

function formatSolve(timeMs: number | null | undefined, penalty: string | null | undefined): string {
	if (penalty === 'DNF') {
		return timeMs != null ? `DNF (${getTimeString(timeMs / 1000, 2)})` : 'DNF';
	}
	if (timeMs == null) return '-';
	return formatBattleTime(timeMs, penalty === 'PLUS_TWO' || penalty === 'PLUS_FOUR' ? penalty : null);
}

function FlagChips({flags}: {flags: Array<string | null | undefined> | null | undefined}) {
	const {t} = useTranslation();
	const list = cleanFlags(flags);
	if (list.length === 0) return null;
	return (
		<div className={b('flags')}>
			{list.map((flag) => (
				<span key={flag} className={b('flag')} title={flag}>
					{flagLabel(flag, t)}
				</span>
			))}
		</div>
	);
}

function PlayerName({player}: {player: Player}) {
	const {t} = useTranslation();
	if (!player?.id || !player.username) {
		return <span className={b('player', {deleted: true})}>{t('admin_online_battle.deleted_account')}</span>;
	}
	return (
		<Link className={b('player')} to={`/user/${player.username}`} onClick={(e) => e.stopPropagation()}>
			{player.username}
		</Link>
	);
}

function MoveLog({json}: {json: string | null | undefined}) {
	const {t} = useTranslation();
	const [open, setOpen] = useState(false);
	const log = parseMoveLog(json);
	if (!log || log.moves.length === 0) {
		return <div className={b('moves-empty')}>{t('admin_online_battle.no_moves')}</div>;
	}
	return (
		<div className={b('moves')}>
			<div className={b('moves-summary')}>
				<span>{t('admin_online_battle.move_count', {count: log.moves.length})}</span>
				{log.missingCubeTs > 0 && (
					<span>{t('admin_online_battle.missing_cube_ts', {count: log.missingCubeTs})}</span>
				)}
				{log.cubeSpanMs != null && (
					<span>{t('admin_online_battle.cube_span', {time: getTimeString(log.cubeSpanMs / 1000, 2)})}</span>
				)}
				<button type="button" className={b('moves-toggle')} onClick={() => setOpen((v) => !v)}>
					{open ? t('admin_online_battle.hide_moves') : t('admin_online_battle.show_moves')}
				</button>
			</div>
			{open && (
				<ol className={b('moves-list')}>
					{log.moves.map((move, i) => (
						<li key={i} className={b('move', {unstamped: move.c == null})}>
							<span className={b('move-turn')}>{move.t}</span>
							<span className={b('move-ts')}>{move.c != null ? move.c : '?'}</span>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}

function RoundCard({round, match}: {round: RoundDetail; match: MatchDetail}) {
	const {t} = useTranslation();
	const sides: Array<{side: 'A' | 'B'; player: Player; time: number | null | undefined; penalty: string | null | undefined; flags: any; moves: string | null | undefined}> = [
		{side: 'A', player: match.player_a, time: round.a_time_ms, penalty: round.a_penalty, flags: round.a_flags, moves: round.a_moves},
		{side: 'B', player: match.player_b, time: round.b_time_ms, penalty: round.b_penalty, flags: round.b_flags, moves: round.b_moves},
	];
	return (
		<div className={b('round')}>
			<div className={b('round-head')}>
				<span className={b('round-title')}>{t('admin_online_battle.round', {n: round.index ?? '?'})}</span>
				{round.winner === 'DRAW' && <span className={b('badge')}>{t('admin_online_battle.draw')}</span>}
			</div>
			<div className={b('scramble')}>{round.scramble}</div>
			<div className={b('round-sides')}>
				{sides.map((s) => (
					<div key={s.side} className={b('round-side', {winner: round.winner === s.side})}>
						<div className={b('round-side-head')}>
							<PlayerName player={s.player} />
							<span className={b('time')}>{formatSolve(s.time, s.penalty)}</span>
						</div>
						<FlagChips flags={s.flags} />
						<MoveLog json={s.moves} />
					</div>
				))}
			</div>
		</div>
	);
}

function RatingLine({player, before, after}: {player: Player; before?: number | null; after?: number | null}) {
	const delta = formatRatingDelta(before, after);
	return (
		<div className={b('rating')}>
			<PlayerName player={player} />
			{before != null && after != null ? (
				<span className={b('rating-values')}>
					{before} → {after} <strong>({delta})</strong>
				</span>
			) : (
				<span className={b('rating-values')}>-</span>
			)}
		</div>
	);
}

function MatchDetailPanel({id, onClose, onVoided}: {id: string; onClose: () => void; onVoided: () => void}) {
	const {t} = useTranslation();
	const {data, loading, error, refetch} = useQuery(BattleMatchDocument, {
		variables: {id},
		fetchPolicy: 'network-only',
	});
	const [voidMatch, {loading: voiding}] = useMutation(AdminVoidBattleMatchDocument);
	const match = data?.battleMatch;

	async function handleVoid() {
		if (!match?.id) return;
		try {
			const res = await voidMatch({variables: {id: match.id}});
			const result = res.data?.adminVoidBattleMatch;
			if (result) {
				const message = voidMessage(result, match);
				toastSuccess(t(message.key, 'names' in message ? {names: message.names} : undefined));
			}
			await refetch();
			onVoided();
		} catch (e) {
			toastError(getGqlErrorMessage(e, t, 'admin_online_battle.void_failed'));
		}
	}

	let body: React.ReactNode;
	if (loading && !match) {
		body = (
			<div className={b('state')}>
				<Loading />
			</div>
		);
	} else if (error) {
		body = <div className={b('state')}>{getGqlErrorMessage(error, t, 'admin_online_battle.load_failed')}</div>;
	} else if (!match) {
		body = <div className={b('state')}>{t('admin_online_battle.not_found')}</div>;
	} else {
		const isVoid = match.status === 'VOID';
		const rounds = (match.rounds || []).filter(Boolean) as RoundDetail[];
		body = (
			<>
				<div className={b('detail-score')}>
					<PlayerName player={match.player_a} />
					<span className={b('score')}>
						{match.rounds_a ?? 0} : {match.rounds_b ?? 0}
					</span>
					<PlayerName player={match.player_b} />
				</div>

				<div className={b('badges')}>
					<span className={b('badge', {strong: !!match.rated})}>
						{match.rated ? t('admin_online_battle.rated') : t('admin_online_battle.unrated')}
					</span>
					{match.is_rematch && <span className={b('badge')}>{t('admin_online_battle.rematch')}</span>}
					{isVoid && <span className={b('badge', {void: true})}>{t('admin_online_battle.status_void')}</span>}
					<span className={b('badge')}>{endReasonLabel(match.end_reason, t)}</span>
					{match.winner === 'DRAW' && <span className={b('badge')}>{t('admin_online_battle.draw')}</span>}
				</div>

				<dl className={b('meta')}>
					<dt>{t('admin_online_battle.started')}</dt>
					<dd>{match.started_at ? getFullFormattedDate(match.started_at) : '-'}</dd>
					<dt>{t('admin_online_battle.ended')}</dt>
					<dd>{match.ended_at ? getFullFormattedDate(match.ended_at) : '-'}</dd>
					{match.voided_at && (
						<>
							<dt>{t('admin_online_battle.voided')}</dt>
							<dd>{getFullFormattedDate(match.voided_at)}</dd>
						</>
					)}
					<dt>{t('admin_online_battle.match_id')}</dt>
					<dd className={b('mono')}>{match.id}</dd>
				</dl>

				{match.rated && (
					<div className={b('ratings')}>
						<RatingLine player={match.player_a} before={match.rating_a_before} after={match.rating_a_after} />
						<RatingLine player={match.player_b} before={match.rating_b_before} after={match.rating_b_after} />
					</div>
				)}

				{cleanFlags(match.flags).length > 0 && (
					<div className={b('block')}>
						<h4 className={b('block-title')}>{t('admin_online_battle.match_flags')}</h4>
						<FlagChips flags={match.flags} />
					</div>
				)}

				<div className={b('block')}>
					<h4 className={b('block-title')}>{t('admin_online_battle.rounds')}</h4>
					{rounds.length === 0 ? (
						<div className={b('moves-empty')}>{t('admin_online_battle.no_rounds')}</div>
					) : (
						rounds.map((round) => <RoundCard key={round.index} round={round} match={match} />)
					)}
				</div>

				{!isVoid && (
					<div className={b('actions')}>
						<Button
							warning
							icon={<Prohibit weight="bold" />}
							text={t('admin_online_battle.void_button')}
							disabled={voiding}
							confirmModalProps={{
								title: t('admin_online_battle.void_confirm_title'),
								description: t('admin_online_battle.void_confirm_description'),
								buttonText: t('admin_online_battle.void_button'),
								buttonProps: {warning: true},
								hideInput: true,
								triggerAction: handleVoid,
							}}
						/>
					</div>
				)}
			</>
		);
	}

	return (
		<section className={b('detail')}>
			<div className={b('detail-head')}>
				<h3 className={b('section-title')}>{t('admin_online_battle.detail_title')}</h3>
				<button type="button" className={b('close')} onClick={onClose} aria-label={t('admin_online_battle.close')}>
					<X weight="bold" />
				</button>
			</div>
			{body}
		</section>
	);
}

function FlaggedRowButton({row, active, onOpen}: {row: FlaggedRow; active: boolean; onOpen: (id: string) => void}) {
	const {t} = useTranslation();
	if (!row?.id) return null;
	const isVoid = row.status === 'VOID';
	return (
		<div
			role="button"
			tabIndex={0}
			className={b('row', {active, void: isVoid})}
			onClick={() => onOpen(row.id as string)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onOpen(row.id as string);
				}
			}}
		>
			<div className={b('row-main')}>
				<PlayerName player={row.player_a} />
				<span className={b('score')}>
					{row.rounds_a ?? 0} : {row.rounds_b ?? 0}
				</span>
				<PlayerName player={row.player_b} />
			</div>
			<div className={b('row-meta')}>
				<span>{row.ended_at ? getFullFormattedDate(row.ended_at) : ''}</span>
				<span className={b('badge', {strong: !!row.rated})}>
					{row.rated ? t('admin_online_battle.rated') : t('admin_online_battle.unrated')}
				</span>
				{isVoid && <span className={b('badge', {void: true})}>{t('admin_online_battle.status_void')}</span>}
				<span>{endReasonLabel(row.end_reason, t)}</span>
			</div>
			<FlagChips flags={row.flags} />
		</div>
	);
}

/**
 * Admin page for Online Battle (design ranking-battle.md 4.7, 4.12, 7.2 step 8): the
 * launch flag's state, the flagged match list, one match in detail (rounds, flags, move
 * logs) and "void this match". The flag itself is switched in Site Config.
 */
export default function AdminBattleMatches() {
	const {t} = useTranslation();
	const siteConfig = useSiteConfig();
	const [page, setPage] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [lookup, setLookup] = useState('');
	const detailRef = useRef<HTMLDivElement>(null);

	const {data, loading, error, refetch} = useQuery(AdminFlaggedBattleMatchesDocument, {
		variables: {page},
		fetchPolicy: 'cache-and-network',
	});

	useEffect(() => {
		if (selectedId && detailRef.current && typeof detailRef.current.scrollIntoView === 'function') {
			detailRef.current.scrollIntoView({behavior: 'smooth', block: 'start'});
		}
	}, [selectedId]);

	const pageData = data?.adminFlaggedBattleMatches;
	const items = (pageData?.items || []).filter(Boolean) as FlaggedRow[];
	const total = pageData?.total ?? 0;
	const hasMore = !!pageData?.hasMore;

	function openLookup(e: React.FormEvent) {
		e.preventDefault();
		const id = normalizeMatchId(lookup);
		if (id) setSelectedId(id);
	}

	const flagOn = siteConfig ? !!siteConfig.online_battle_enabled : null;

	return (
		<div className={b()}>
			<PageTitle pageName={t('admin_online_battle.title')} />

			<div className={b('flag-state')}>
				<span className={b('flag-dot', {on: flagOn === true})} />
				<span>
					{flagOn === null
						? t('admin_online_battle.flag_unknown')
						: flagOn
							? t('admin_online_battle.flag_on')
							: t('admin_online_battle.flag_off')}
				</span>
				<Link to="/admin/site-config" className={b('flag-link')}>
					{t('admin_online_battle.flag_link')}
				</Link>
			</div>

			<form className={b('lookup')} onSubmit={openLookup}>
				<div className={b('lookup-input')}>
					<Input
						value={lookup}
						onChange={(e) => setLookup(e.target.value)}
						placeholder={t('admin_online_battle.lookup_placeholder')}
						maxWidth
					/>
				</div>
				<Button type="submit" text={t('admin_online_battle.lookup_button')} disabled={!normalizeMatchId(lookup)} />
			</form>

			{selectedId && (
				<div ref={detailRef}>
					<MatchDetailPanel
						key={selectedId}
						id={selectedId}
						onClose={() => setSelectedId(null)}
						onVoided={() => refetch()}
					/>
				</div>
			)}

			<section className={b('list')}>
				<h3 className={b('section-title')}>{t('admin_online_battle.flagged_title')}</h3>
				<p className={b('hint')}>{t('admin_online_battle.flagged_hint')}</p>
				<div className={b('count')}>{t('admin_online_battle.total_count', {count: total})}</div>

				{loading && items.length === 0 ? (
					<div className={b('state')}>
						<Loading />
					</div>
				) : error && items.length === 0 ? (
					<div className={b('state')}>{getGqlErrorMessage(error, t, 'admin_online_battle.load_failed')}</div>
				) : items.length === 0 ? (
					<div className={b('state')}>
						<Empty text={t('admin_online_battle.empty')} />
					</div>
				) : (
					<div className={b('rows')}>
						{items.map((row) => (
							<FlaggedRowButton key={row.id} row={row} active={row.id === selectedId} onOpen={setSelectedId} />
						))}
					</div>
				)}

				{(page > 0 || hasMore) && (
					<div className={b('pagination')}>
						<Button
							text={t('admin_online_battle.previous')}
							disabled={page === 0}
							onClick={() => setPage((p) => Math.max(0, p - 1))}
						/>
						<span className={b('page-info')}>{t('admin_online_battle.page', {current: page + 1})}</span>
						<Button text={t('admin_online_battle.next')} disabled={!hasMore} onClick={() => setPage((p) => p + 1)} />
					</div>
				)}
			</section>
		</div>
	);
}
