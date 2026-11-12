import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {CloseButton} from '../icon_button/IconButton';
import {fetchTrendingGifs, GifItem, rememberGif, reportGifShare, searchGifs} from '../../../lib/klipy';
import block from '../../../styles/bem';
import './GifPicker.scss';

const b = block('gif-picker');

// Typing pauses this long before a search goes out. The test key has 100 calls an
// hour, and a request per keystroke would spend it in one sentence.
const SEARCH_DEBOUNCE_MS = 400;
// Distance from the bottom of the grid at which the next page starts loading.
const LOAD_MORE_PX = 240;

interface Props {
	/** The GIF the user tapped; its share is already reported to KLIPY. */
	onPick: (item: GifItem) => void;
	onClose: () => void;
	className?: string;
}

/**
 * Trending and search, WhatsApp style.
 *
 * Nothing is fetched until this opens, so a user who never taps the GIF button never
 * talks to KLIPY. Results stay in the order KLIPY returns them (their terms forbid
 * reordering or filtering client-side; the G-only filter is set on their side), laid out
 * in rows left to right so the reading order is their order.
 */
export default function GifPicker({onPick, onClose, className}: Props) {
	const {t, i18n} = useTranslation();
	const [query, setQuery] = useState('');
	const [items, setItems] = useState<GifItem[]>([]);
	const [page, setPage] = useState(1);
	const [hasNext, setHasNext] = useState(false);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	// Drops responses that arrive after the query has already changed.
	const requestSeq = useRef(0);

	const language = i18n.language;

	const load = useCallback(
		async (term: string, nextPage: number) => {
			const seq = ++requestSeq.current;
			setLoading(true);
			setFailed(false);
			try {
				const result = term
					? await searchGifs(term, nextPage, language)
					: await fetchTrendingGifs(nextPage, language);
				if (seq !== requestSeq.current) return;
				setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
				setHasNext(result.hasNext);
				setPage(nextPage);
			} catch {
				if (seq !== requestSeq.current) return;
				setFailed(true);
			} finally {
				if (seq === requestSeq.current) setLoading(false);
			}
		},
		[language]
	);

	useEffect(() => {
		const term = query.trim();
		const timer = setTimeout(
			() => {
				listRef.current?.scrollTo({top: 0});
				void load(term, 1);
			},
			term ? SEARCH_DEBOUNCE_MS : 0
		);
		return () => clearTimeout(timer);
	}, [query, load]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	function handleScroll() {
		const el = listRef.current;
		if (!el || loading || !hasNext) return;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_PX) {
			void load(query.trim(), page + 1);
		}
	}

	function pick(item: GifItem) {
		rememberGif(item);
		reportGifShare(item.slug, query.trim());
		onPick(item);
	}

	return (
		<div className={b() + (className ? ' ' + className : '')}>
			<div className={b('head')}>
				<input
					autoFocus
					className={b('search')}
					value={query}
					// "Search KLIPY" is the one attribution KLIPY requires.
					placeholder={t('gif.search_placeholder')}
					aria-label={t('gif.search_placeholder')}
					onChange={(e) => setQuery(e.target.value)}
				/>
				<CloseButton size="sm" onClick={onClose} />
			</div>

			<div className={b('list')} ref={listRef} onScroll={handleScroll}>
				{failed && items.length === 0 ? (
					<p className={b('empty')}>{t('gif.load_failed')}</p>
				) : !loading && items.length === 0 ? (
					<p className={b('empty')}>{t('gif.no_results')}</p>
				) : (
					<div className={b('grid')}>
						{items.map((item) => (
							<button
								key={item.slug}
								type="button"
								className={b('item')}
								style={{flexGrow: item.width / item.height, width: `${(96 * item.width) / item.height}px`}}
								title={item.title}
								onClick={() => pick(item)}
							>
								<img
									src={item.previewUrl}
									alt={item.title || 'GIF'}
									loading="lazy"
									referrerPolicy="no-referrer"
									draggable={false}
								/>
							</button>
						))}
					</div>
				)}
				{loading && <p className={b('status')}>{t('gif.loading')}</p>}
			</div>

			<p className={b('credit')}>{t('gif.attribution')}</p>
		</div>
	);
}
