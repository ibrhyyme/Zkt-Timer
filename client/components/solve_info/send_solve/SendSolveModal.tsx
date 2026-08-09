// "Send this solve to someone" from the solve card itself.
//
// The other direction already existed: open a chat, hit the cube button, pick a solve
// from a list. Nobody works that way. People finish a solve, look at it, and want to
// show it to someone right then. This is that path, and it reuses the same
// privacy-respecting recipient search as the compose screen: nothing is listed until
// you type, and anyone who opted out of being found never appears.

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {MagnifyingGlass, X, PaperPlaneRight} from 'phosphor-react';
import AvatarImage from '../../common/avatar/avatar_image/AvatarImage';
import Loading from '../../common/loading/Loading';
import Button from '../../common/button/Button';
import {gqlMutateTyped, gqlQueryTyped} from '../../api';
import {
	ConversationsDocument,
	ConversationsQuery,
	MessageRecipientSearchDocument,
	MessageRecipientSearchQuery,
	SendMessageDocument,
} from '../../../@types/generated/graphql';
import {toastError, toastSuccess} from '../../../util/toast';
import block from '../../../styles/bem';
import './SendSolveModal.scss';

const b = block('send-solve');

type Recipient = MessageRecipientSearchQuery['messageRecipientSearch'][number];

interface Props {
	solveId: string;
	onClose: () => void;
}

export default function SendSolveModal({solveId, onClose}: Props) {
	const {t} = useTranslation();
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<Recipient[]>([]);
	const [searching, setSearching] = useState(false);
	const [picked, setPicked] = useState<Recipient | null>(null);
	const [note, setNote] = useState('');
	const [sending, setSending] = useState(false);
	const [recent, setRecent] = useState<Recipient[]>([]);

	// People you already talk to, shown before you type anything. The search-only rule
	// exists so nobody can browse the member list; it was never meant to make you hunt
	// for the person you messaged an hour ago, whose name is already in your inbox.
	useEffect(() => {
		let cancelled = false;
		gqlQueryTyped(ConversationsDocument, {}, {fetchPolicy: 'no-cache'})
			.then((res) => {
				if (cancelled) return;
				const rows = (res?.data as ConversationsQuery)?.conversations?.conversations || [];
				setRecent(rows.map((c) => c.other_user).filter(Boolean) as Recipient[]);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const term = query.trim();
		if (term.length < 2) {
			setResults([]);
			return;
		}

		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await gqlQueryTyped(MessageRecipientSearchDocument, {query: term}, {fetchPolicy: 'no-cache'});
				if (!cancelled) {
					setResults((res?.data?.messageRecipientSearch as Recipient[]) || []);
				}
			} catch {
				if (!cancelled) setResults([]);
			} finally {
				if (!cancelled) setSearching(false);
			}
		}, 250);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [query]);

	async function send() {
		if (!picked || sending) return;

		setSending(true);
		try {
			await gqlMutateTyped(SendMessageDocument, {
				body: note.trim(),
				recipientId: picked.id,
				solveId,
			});
			toastSuccess(t('solve_info.send_sent', {name: picked.username}));
			onClose();
		} catch (e) {
			toastError(e as Error);
		} finally {
			setSending(false);
		}
	}

	return (
		<div className={b('backdrop')} onClick={onClose}>
			<div className={b()} onClick={(e) => e.stopPropagation()}>
				<div className={b('head')}>
					<span className={b('title')}>{t('solve_info.send_title')}</span>
					<button type="button" className={b('close')} aria-label={t('solve_info.send_cancel')} onClick={onClose}>
						<X weight="bold" />
					</button>
				</div>

				{picked ? (
					<div className={b('picked')}>
						<AvatarImage small user={picked as any} profile={(picked as any)?.profile} />
						<span className={b('picked-name')}>{picked.username}</span>
						<button
							type="button"
							className={b('picked-change')}
							onClick={() => {
								setPicked(null);
								setQuery('');
							}}
						>
							{t('solve_info.send_change')}
						</button>
					</div>
				) : (
					<>
						<label className={b('search')}>
							<MagnifyingGlass weight="bold" />
							<input
								autoFocus
								value={query}
								placeholder={t('solve_info.send_search')}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</label>

						<div className={b('results')}>
							{searching && <Loading />}

							{/* Nothing typed yet: offer the recent threads, and only fall back
							    to the "type a username" hint when there are none. */}
							{!searching && query.trim().length < 2 && recent.length > 0 && (
								<>
									<span className={b('section')}>{t('solve_info.send_recent')}</span>
									{recent.map((user) => (
										<button key={user.id} type="button" className={b('hit')} onClick={() => setPicked(user)}>
											<AvatarImage small user={user as any} profile={(user as any)?.profile} />
											<span>{user.username}</span>
										</button>
									))}
								</>
							)}
							{!searching && query.trim().length < 2 && recent.length === 0 && (
								<p className={b('hint')}>{t('solve_info.send_hint')}</p>
							)}

							{!searching && query.trim().length >= 2 && results.length === 0 && (
								<p className={b('hint')}>{t('solve_info.send_none')}</p>
							)}
							{query.trim().length >= 2 &&
								results.map((user) => (
									<button key={user.id} type="button" className={b('hit')} onClick={() => setPicked(user)}>
										<AvatarImage small user={user as any} profile={(user as any)?.profile} />
										<span>{user.username}</span>
									</button>
								))}
						</div>
					</>
				)}

				{picked && (
					<textarea
						className={b('note')}
						value={note}
						maxLength={500}
						placeholder={t('solve_info.send_note')}
						onChange={(e) => setNote(e.target.value)}
					/>
				)}

				<div className={b('actions')}>
					<Button gray text={t('solve_info.send_cancel')} onClick={onClose} />
					<Button
						primary
						disabled={!picked || sending}
						icon={<PaperPlaneRight weight="bold" />}
						text={t('solve_info.send_action')}
						onClick={send}
					/>
				</div>
			</div>
		</div>
	);
}
