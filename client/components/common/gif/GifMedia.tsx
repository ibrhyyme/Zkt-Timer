import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {GifItem, resolveGif} from '../../../lib/klipy';
import block from '../../../styles/bem';
import './GifMedia.scss';

const b = block('gif-media');

// Before KLIPY answers the box has no ratio yet; this keeps the thread from jumping
// more than once.
const PLACEHOLDER_RATIO = 0.75;

interface Props {
	provider: string | null | undefined;
	gifId: string;
	/** Widest the picture may draw, in px. */
	maxWidth?: number;
	className?: string;
}

/**
 * A GIF inside a message, resolved from the stored id on the reader's device.
 *
 * The message only ever holds the provider's id (shared/gif.ts), so the media comes from
 * KLIPY at render time, from the exact URL they return. A GIF KLIPY has since removed,
 * or a build without a key, shows a short "GIF unavailable" line instead of a hole.
 */
export default function GifMedia({provider, gifId, maxWidth = 220, className}: Props) {
	const {t} = useTranslation();
	const [item, setItem] = useState<GifItem | null>(null);
	const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

	useEffect(() => {
		let alive = true;
		setState('loading');
		resolveGif(provider, gifId).then((found) => {
			if (!alive) return;
			setItem(found);
			setState(found ? 'ready' : 'missing');
		});
		return () => {
			alive = false;
		};
	}, [provider, gifId]);

	const cls = b({state}) + (className ? ' ' + className : '');

	if (state === 'missing') {
		return <span className={cls}>{t('gif.unavailable')}</span>;
	}

	const ratio = item ? item.height / item.width : PLACEHOLDER_RATIO;
	const width = item ? Math.min(maxWidth, Math.max(item.width, 120)) : maxWidth;

	return (
		<span
			className={cls}
			style={{
				width: `${width}px`,
				maxWidth: '100%',
				aspectRatio: `${1 / ratio}`,
				backgroundImage: item?.blur ? `url("${item.blur}")` : undefined,
			}}
		>
			{item && (
				<img src={item.url} alt={item.title || 'GIF'} loading="lazy" referrerPolicy="no-referrer" draggable={false} />
			)}
		</span>
	);
}
