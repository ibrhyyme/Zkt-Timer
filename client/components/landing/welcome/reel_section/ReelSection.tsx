import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {landingAsset} from '../../../../util/api-base';
import {REEL} from '../landing-data';
import InViewVideo from '../in_view_video/InViewVideo';
import './ReelSection.scss';

const b = block('welcome-reel');

// Same edge as $bp-md, so the film and its frame switch shape at one width.
const TALL_QUERY = '(max-width: 767.98px)';

/**
 * The film: a short silent loop, rendered with Remotion, right under the hero.
 *
 * The server sends only a poster (a <picture>, so a phone gets the tall one). The
 * browser then picks the wide or tall film once and swaps it in; nothing downloads
 * until the frame scrolls into view.
 */
export default function ReelSection() {
	const {t} = useTranslation();
	const [shape, setShape] = useState<'wide' | 'tall' | null>(null);

	useEffect(() => {
		const query = window.matchMedia(TALL_QUERY);
		const pick = () => setShape(query.matches ? 'tall' : 'wide');
		pick();
		query.addEventListener?.('change', pick);
		return () => query.removeEventListener?.('change', pick);
	}, []);

	const label = t('welcome_reel.label');

	return (
		<section className={b()} aria-label={label}>
			<div className={b('frame')}>
				{shape ? (
					<InViewVideo
						key={shape}
						className={b('media')}
						mp4={landingAsset(REEL[shape].mp4)}
						poster={landingAsset(REEL[shape].poster)}
						label={label}
					/>
				) : (
					<picture>
						<source media={TALL_QUERY} srcSet={landingAsset(REEL.tall.poster)} />
						<img className={b('media')} src={landingAsset(REEL.wide.poster)} alt="" loading="lazy" />
					</picture>
				)}
			</div>
			<p className={b('caption')}>{t('welcome_reel.caption')}</p>
		</section>
	);
}
