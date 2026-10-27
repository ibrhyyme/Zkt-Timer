import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {landingAsset} from '../../../../util/api-base';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../../timer/smart_cube/bluetooth/supported_cubes';
import {CHAPTERS, STICKER, stickerTint} from '../landing-data';
import NotationHeading from '../notation_heading/NotationHeading';
import LayerStage from './LayerStage';
import {usePinnedSteps} from '../pinned/usePinnedSteps';
import StepTabs from '../pinned/StepTabs';
import './ChaptersSection.scss';

const b = block('welcome-chapters');

const FACT_KEYS = ['fact_1', 'fact_2', 'fact_3'] as const;


interface View {
	active: number;
	/** The chapter that was on before, while it plays its way out. */
	leaving: number;
}

/**
 * Six chapters, one per part of the app.
 *
 * Wide screens: the scene pins to the viewport and each wheel tick, arrow key or Space
 * moves exactly one chapter (usePinnedSteps). The text of the outgoing chapter slides
 * away in the direction of travel while the next one comes in line by line, the stage
 * turns its layers to the new screen, and the tabs underneath track the way through.
 * Past the last chapter the page scrolls on.
 *
 * Phones and tablets: the chapters stack, each a screen of its own (picture first), and
 * the browser's own proximity snapping settles a swipe on the next one.
 */
export default function ChaptersSection() {
	const {t} = useTranslation();
	const [view, setView] = useState<View>({active: 0, leaving: -1});
	const [revealed, setRevealed] = useState(false);
	const sectionRef = useRef<HTMLElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const pinRef = useRef<HTMLDivElement>(null);
	const chapterRefs = useRef<(HTMLElement | null)[]>([]);

	const show = useCallback((index: number) => {
		setView((v) => (v.active === index ? v : {active: index, leaving: v.active}));
	}, []);

	const {goTo} = usePinnedSteps({
		trackRef,
		pinRef,
		count: CHAPTERS.length,
		active: view.active,
		onChange: show,
	});

	// The chapter titles replay their notation only once the section has been reached,
	// not while it is still far below the hero.
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || !('IntersectionObserver' in window)) {
			setRevealed(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				setRevealed(true);
				observer.disconnect();
			},
			{threshold: 0.15}
		);
		observer.observe(section);
		return () => observer.disconnect();
	}, []);

	// Stacked layout: each chapter comes in the first time it reaches the middle of the
	// screen, and that chapter counts as the active one. data-* is written to the DOM
	// directly so React's className updates never wipe it.
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || !('IntersectionObserver' in window)) return;
		if (window.matchMedia('(min-width: 1024px)').matches) return;
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			section.dataset.motion = 'on';
		}
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					const el = entry.target as HTMLElement;
					el.dataset.seen = 'true';
					show(Number(el.dataset.index));
				});
			},
			{rootMargin: '-35% 0px -35% 0px'}
		);
		chapterRefs.current.forEach((el) => el && observer.observe(el));
		return () => {
			observer.disconnect();
			delete section.dataset.motion;
		};
	}, [show]);

	const vars = {brands: SUPPORTED_SMART_CUBE_BRANDS.length};
	const labels = CHAPTERS.map((c) => t(`welcome_chapters.${c.id}.caption`));

	const stateOf = (i: number) => (i === view.active ? 'active' : i < view.active ? 'before' : 'after');

	return (
		<section ref={sectionRef} className={b()}>
			<div className={b('container')}>
				<header className={b('header')}>
					<NotationHeading className={b('title')} text={t('welcome_chapters.title')} />
					<p className={b('lede')}>{t('welcome_chapters.lede')}</p>
				</header>
			</div>

			<div
				ref={trackRef}
				className={b('track')}
				style={{'--count': CHAPTERS.length} as React.CSSProperties}
			>
				<div ref={pinRef} className={b('pin')}>
					<div className={b('scene')}>
						<div className={b('texts')}>
							{CHAPTERS.map((chapter, i) => (
								<article
									key={chapter.id}
									ref={(el) => {
										chapterRefs.current[i] = el;
									}}
									data-index={i}
									className={b('chapter', {state: stateOf(i), leaving: i === view.leaving})}
									style={{'--face': STICKER[chapter.face]} as React.CSSProperties}
								>
									{/* Phones and tablets only; wide screens show the pinned stage. */}
									<figure className={b('inline-visual')}>
										<img
											className={b('inline-media')}
											src={landingAsset(chapter.image)}
											alt={labels[i]}
											loading="lazy"
											decoding="async"
											width={1920}
											height={1080}
										/>
										<figcaption className={b('caption')}>{labels[i]}</figcaption>
									</figure>

									<div className={b('line')} style={{'--i': 0} as React.CSSProperties}>
										<div className={b('marker')}>
											<span className={b('sticker')} style={{background: STICKER[chapter.face]}} />
											<span className={b('name')}>{t(`welcome_chapters.${chapter.id}.name`)}</span>
											{chapter.pro && <span className={b('pro')}>Pro</span>}
										</div>
									</div>
									<div className={b('line')} style={{'--i': 1} as React.CSSProperties}>
										<NotationHeading
											as="h3"
											className={b('chapter-title')}
											text={t(`welcome_chapters.${chapter.id}.title`)}
											play={revealed && i === view.active}
										/>
									</div>
									<p className={b('line', {body: true})} style={{'--i': 2} as React.CSSProperties}>
										{t(`welcome_chapters.${chapter.id}.body`)}
									</p>
									<ul className={b('line', {facts: true})} style={{'--i': 3} as React.CSSProperties}>
										{FACT_KEYS.map((key) => (
											<li key={key} className={b('fact')}>
												{t(`welcome_chapters.${chapter.id}.${key}`, vars)}
											</li>
										))}
									</ul>
								</article>
							))}
						</div>

						<div
							className={b('stage-col')}
							style={{'--tint': stickerTint(CHAPTERS[view.active].face)} as React.CSSProperties}
						>
							<div className={b('screen')}>
								<LayerStage chapters={CHAPTERS} active={view.active} labels={labels} />
							</div>
							<p className={b('stage-caption')} aria-live="polite">
								{labels[view.active]}
							</p>
						</div>

						<StepTabs
							className={b('tabs')}
							items={CHAPTERS.map((chapter) => ({
								key: chapter.id,
								label: t(`welcome_chapters.${chapter.id}.name`),
								color: STICKER[chapter.face],
							}))}
							active={view.active}
							onSelect={goTo}
							label={t('welcome_chapters.title')}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
