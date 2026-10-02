import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {landingAsset} from '../../../../util/api-base';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../../timer/smart_cube/bluetooth/supported_cubes';
import {CHAPTERS, STICKER} from '../landing-data';
import NotationHeading from '../notation_heading/NotationHeading';
import InViewVideo from '../in_view_video/InViewVideo';
import LayerStage from './LayerStage';
import './ChaptersSection.scss';

const b = block('welcome-chapters');

const FACT_KEYS = ['fact_1', 'fact_2', 'fact_3'] as const;

/**
 * Six chapters, one per part of the app. On a wide screen the text scrolls past a
 * pinned stage that turns to each chapter's screen; on a narrow one every chapter
 * carries its own picture inline.
 */
export default function ChaptersSection() {
	const {t} = useTranslation();
	const [active, setActive] = useState(0);
	const chapterRefs = useRef<(HTMLElement | null)[]>([]);

	// Whichever chapter crosses the middle of the viewport is the active one.
	useEffect(() => {
		if (!('IntersectionObserver' in window)) return;
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActive(Number((entry.target as HTMLElement).dataset.index));
					}
				});
			},
			{rootMargin: '-50% 0px -50% 0px'}
		);
		chapterRefs.current.forEach((el) => el && observer.observe(el));
		return () => observer.disconnect();
	}, []);

	const goTo = (index: number) => {
		const el = chapterRefs.current[index];
		if (!el) return;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'center'});
	};

	const vars = {brands: SUPPORTED_SMART_CUBE_BRANDS.length};
	const labels = CHAPTERS.map((c) => t(`welcome_chapters.${c.id}.caption`));

	return (
		<section className={b()}>
			<div className={b('container')}>
				<header className={b('header')}>
					<NotationHeading className={b('title')} text={t('welcome_chapters.title')} />
					<p className={b('lede')}>{t('welcome_chapters.lede')}</p>
				</header>

				<div className={b('body')}>
					<div className={b('text')}>
						{CHAPTERS.map((chapter, i) => (
							<article
								key={chapter.id}
								ref={(el) => {
									chapterRefs.current[i] = el;
								}}
								data-index={i}
								className={b('chapter', {active: i === active})}
								style={{'--face': STICKER[chapter.face]} as React.CSSProperties}
							>
								<div className={b('marker')}>
									<span className={b('sticker')} style={{background: STICKER[chapter.face]}} />
									<span className={b('name')}>{t(`welcome_chapters.${chapter.id}.name`)}</span>
									{chapter.pro && <span className={b('pro')}>Pro</span>}
								</div>
								<NotationHeading
									as="h3"
									className={b('chapter-title')}
									text={t(`welcome_chapters.${chapter.id}.title`)}
								/>
								<p className={b('chapter-body')}>{t(`welcome_chapters.${chapter.id}.body`)}</p>
								<ul className={b('facts')}>
									{FACT_KEYS.map((key) => (
										<li key={key} className={b('fact')}>
											{t(`welcome_chapters.${chapter.id}.${key}`, vars)}
										</li>
									))}
								</ul>

								{/* Narrow screens only; the pinned stage takes over above 1024px. */}
								<figure className={b('inline-visual')}>
									{chapter.video ? (
										<InViewVideo
											className={b('inline-media')}
											mp4={landingAsset(chapter.video.mp4)}
											poster={landingAsset(chapter.image)}
											label={labels[i]}
											width={1920}
											height={1080}
										/>
									) : (
										<img
											className={b('inline-media')}
											src={landingAsset(chapter.image)}
											alt={labels[i]}
											loading="lazy"
											decoding="async"
											width={1920}
											height={1080}
										/>
									)}
									<figcaption className={b('caption')}>{labels[i]}</figcaption>
								</figure>
							</article>
						))}
					</div>

					<div className={b('stage-col')}>
						<div className={b('pin')}>
							<LayerStage chapters={CHAPTERS} active={active} labels={labels} />
							<div className={b('rail')}>
								<div className={b('stickers')} role="tablist" aria-label={t('welcome_chapters.title')}>
									{CHAPTERS.map((chapter, i) => (
										<button
											key={chapter.id}
											type="button"
											role="tab"
											aria-selected={i === active}
											aria-label={t(`welcome_chapters.${chapter.id}.name`)}
											className={b('rail-sticker', {active: i === active})}
											style={{background: STICKER[chapter.face]}}
											onClick={() => goTo(i)}
										/>
									))}
								</div>
								<p className={b('rail-caption')} aria-live="polite">
									{labels[active]}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
