import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {motion, AnimatePresence} from 'framer-motion';
import {Lightning, Hand, CheckCircle, ArrowRight} from 'phosphor-react';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {useInView} from '../hooks/useInView';
import './LiveTimerSection.scss';

const b = block('welcome-live-timer');

type Phase = 'ready' | 'inspecting' | 'solving' | 'done';

interface PhaseConfig {
	durationMs: number;
	next: Phase;
}

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
	ready: {durationMs: 1500, next: 'inspecting'},
	inspecting: {durationMs: 4500, next: 'solving'},
	solving: {durationMs: 6800, next: 'done'},
	done: {durationMs: 2500, next: 'ready'},
};

const FINAL_TIMES = [7.82, 9.14, 8.56, 10.21, 6.93, 11.48];

function formatTime(seconds: number): string {
	return seconds.toFixed(2);
}

function formatInspection(remaining: number): string {
	return Math.max(0, Math.ceil(remaining)).toString();
}

export default function LiveTimerSection() {
	const {t} = useTranslation();
	const {ref: sectionRef, isInView} = useInView({threshold: 0.25, triggerOnce: false});

	const [phase, setPhase] = useState<Phase>('ready');
	const [displayTime, setDisplayTime] = useState(0);
	const [finalTimeIdx, setFinalTimeIdx] = useState(0);

	const phaseStartRef = useRef<number>(0);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		if (!isInView) {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			return;
		}

		phaseStartRef.current = performance.now();

		const tick = (now: number) => {
			const elapsed = now - phaseStartRef.current;
			const cfg = PHASE_CONFIG[phase];

			if (phase === 'inspecting') {
				setDisplayTime(Math.max(0, 15 - elapsed / 1000));
			} else if (phase === 'solving') {
				setDisplayTime(elapsed / 1000);
			} else if (phase === 'done') {
				setDisplayTime(FINAL_TIMES[finalTimeIdx]);
			} else {
				setDisplayTime(0);
			}

			if (elapsed >= cfg.durationMs) {
				const nextPhase = cfg.next;
				phaseStartRef.current = now;
				if (phase === 'solving') {
					setFinalTimeIdx((i) => (i + 1) % FINAL_TIMES.length);
				}
				setPhase(nextPhase);
			}
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [phase, isInView, finalTimeIdx]);

	const phaseLabel = t(`welcome_live_timer.phase_${phase}`);
	const mainNumber =
		phase === 'inspecting' ? formatInspection(displayTime) : formatTime(displayTime);

	return (
		<section ref={sectionRef as any} className={b()}>
			<div className={b('background')}>
				<div className={b('grid-bg')} />
				<div className={b('orb', {position: 'left'})} />
				<div className={b('orb', {position: 'right'})} />
			</div>

			<div className={b('container')}>
				<motion.div
					className={b('header')}
					initial={{opacity: 0, y: 30}}
					whileInView={{opacity: 1, y: 0}}
					viewport={{once: true, amount: 0.3}}
					transition={{duration: 0.6}}
				>
					<div className={b('eyebrow')}>
						<Lightning size={16} weight="fill" />
						<span>{t('welcome_live_timer.eyebrow')}</span>
					</div>
					<h2 className={b('title')}>{t('welcome_live_timer.title')}</h2>
					<p className={b('subtitle')}>{t('welcome_live_timer.subtitle')}</p>
				</motion.div>

				<div className={b('showcase')}>
					{/* Timer display */}
					<motion.div
						className={b('timer', {phase})}
						initial={{opacity: 0, scale: 0.95}}
						whileInView={{opacity: 1, scale: 1}}
						viewport={{once: true, amount: 0.3}}
						transition={{duration: 0.5, delay: 0.1}}
					>
						<div className={b('timer-chrome')}>
							<span className={b('chrome-dot', {color: 'red'})} />
							<span className={b('chrome-dot', {color: 'yellow'})} />
							<span className={b('chrome-dot', {color: 'green'})} />
							<span className={b('chrome-label')}>zktimer.app</span>
						</div>

						<div className={b('scramble')}>
							<span className={b('scramble-label')}>{t('welcome_live_timer.scramble')}</span>
							<span className={b('scramble-text')}>R U R' U' R' F R F'</span>
						</div>

						<AnimatePresence exitBeforeEnter>
							<motion.div
								key={phase}
								className={b('phase-pill', {phase})}
								initial={{opacity: 0, y: -6}}
								animate={{opacity: 1, y: 0}}
								exit={{opacity: 0, y: 6}}
								transition={{duration: 0.2}}
							>
								{phase === 'ready' && <Hand size={14} weight="duotone" />}
								{phase === 'done' && <CheckCircle size={14} weight="fill" />}
								<span>{phaseLabel}</span>
							</motion.div>
						</AnimatePresence>

						<motion.div
							className={b('time')}
							animate={{
								color:
									phase === 'inspecting'
										? '#f59e0b'
										: phase === 'solving'
										? '#ffffff'
										: phase === 'done'
										? '#4ade80'
										: 'rgba(255,255,255,0.4)',
							}}
							transition={{duration: 0.25}}
						>
							{mainNumber}
							{phase !== 'inspecting' && <span className={b('time-unit')}>s</span>}
						</motion.div>

						<div className={b('avg-row')}>
							<div className={b('avg-box')}>
								<span className={b('avg-label')}>Ao5</span>
								<span className={b('avg-value')}>8.73</span>
							</div>
							<div className={b('avg-box')}>
								<span className={b('avg-label')}>Ao12</span>
								<span className={b('avg-value')}>9.42</span>
							</div>
							<div className={b('avg-box', {highlight: true})}>
								<span className={b('avg-label')}>PB</span>
								<span className={b('avg-value')}>6.93</span>
							</div>
						</div>
					</motion.div>

					{/* Side bullets */}
					<motion.div
						className={b('features')}
						initial="hidden"
						whileInView="visible"
						viewport={{once: true, amount: 0.3}}
						variants={{
							hidden: {},
							visible: {transition: {staggerChildren: 0.12, delayChildren: 0.2}},
						}}
					>
						{['inspection', 'penalty', 'smart_cube', 'stackmat'].map((key) => (
							<motion.div
								key={key}
								className={b('feature')}
								variants={{
									hidden: {opacity: 0, x: 30},
									visible: {opacity: 1, x: 0, transition: {duration: 0.5}},
								}}
							>
								<div className={b('feature-icon')}>
									<CheckCircle size={18} weight="fill" />
								</div>
								<div className={b('feature-body')}>
									<h4 className={b('feature-title')}>
										{t(`welcome_live_timer.feature_${key}_title`)}
									</h4>
									<p className={b('feature-desc')}>
										{t(`welcome_live_timer.feature_${key}_desc`)}
									</p>
								</div>
							</motion.div>
						))}

						<Button
							large
							primary
							glow
							onClick={() => (window.location.href = '/signup')}
						>
							{t('welcome_live_timer.cta')}
							<ArrowRight size={18} weight="bold" style={{marginLeft: '0.5rem'}} />
						</Button>
					</motion.div>
				</div>
			</div>
		</section>
	);
}
