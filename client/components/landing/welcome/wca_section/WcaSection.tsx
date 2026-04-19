import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {
	Trophy,
	MapPin,
	CalendarBlank,
	Broadcast,
	Cube,
	UsersThree,
	Bell,
	MapTrifold,
	ListChecks,
	ArrowRight,
} from 'phosphor-react';
import {gqlQueryTyped} from '../../../api';
import {
	WcaCompetitionsDocument,
	LandingStatsDocument,
} from '../../../../@types/generated/graphql';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {useInView} from '../hooks/useInView';
import {useCountUp} from '../hooks/useCountUp';
import {staggerContainer, fadeInUp, hoverLift, tapScale} from '../motion-variants';
import './WcaSection.scss';

const b = block('welcome-wca');

interface WcaComp {
	id: string;
	name: string;
	city: string;
	country_iso2: string;
	start_date: string;
	end_date: string;
	date_range: string;
	event_ids: string[];
}

interface LandingStatsData {
	upcoming_wca_competition_count?: number;
	total_competitor_capacity?: number;
	supported_event_count?: number;
	supported_language_count?: number;
	cuber_count?: number;
	solve_count?: number;
}

const I18N_LOCALE_MAP: Record<string, string> = {
	tr: 'tr-TR',
	en: 'en-US',
	es: 'es-ES',
	ru: 'ru-RU',
};

function formatDateRange(startDate: string, endDate: string, lang: string): string {
	const locale = I18N_LOCALE_MAP[lang] || lang;
	const start = new Date(startDate + 'T00:00:00');
	const end = new Date(endDate + 'T00:00:00');
	const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, opts);

	if (startDate === endDate) {
		return fmt(start, {day: 'numeric', month: 'short', year: 'numeric'});
	}
	if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
		return `${fmt(start, {day: 'numeric'})} - ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}`;
	}
	return `${fmt(start, {day: 'numeric', month: 'short'})} - ${fmt(end, {day: 'numeric', month: 'short', year: 'numeric'})}`;
}

function StatCounter({label, target, active}: {label: string; target: number; active: boolean}) {
	const value = useCountUp(target, {duration: 2000, active});
	return (
		<div className={b('stat')}>
			<div className={b('stat-value')}>{value.toLocaleString()}</div>
			<div className={b('stat-label')}>{label}</div>
		</div>
	);
}

const FEATURE_ICONS = [Broadcast, Bell, ListChecks, MapTrifold, UsersThree, Trophy] as const;

export default function WcaSection() {
	const {t, i18n} = useTranslation();
	const lang = i18n.language || 'en';

	const [competitions, setCompetitions] = useState<WcaComp[] | null>(null);
	const [stats, setStats] = useState<LandingStatsData | null>(null);

	const {ref: statsRef, isInView: statsInView} = useInView({threshold: 0.3, triggerOnce: true});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [compsRes, statsRes] = await Promise.all([
					gqlQueryTyped(WcaCompetitionsDocument, {filter: {}}, {fetchPolicy: 'cache-first'}),
					gqlQueryTyped(LandingStatsDocument, {}, {fetchPolicy: 'cache-first'}),
				]);
				if (cancelled) return;
				const comps = (compsRes.data?.wcaCompetitions || []) as WcaComp[];
				setCompetitions(comps.slice(0, 4));
				setStats(statsRes.data?.landingStats || null);
			} catch {
				if (!cancelled) {
					setCompetitions([]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const FEATURES = [
		{key: 'live', iconIdx: 0},
		{key: 'notifications', iconIdx: 1},
		{key: 'assignments', iconIdx: 2},
		{key: 'venue', iconIdx: 3},
		{key: 'competitors', iconIdx: 4},
		{key: 'records', iconIdx: 5},
	];

	const STATS = stats
		? [
				{label: t('welcome_wca.stat_wca_upcoming'), value: stats.upcoming_wca_competition_count ?? 0},
				{label: t('welcome_wca.stat_capacity'), value: stats.total_competitor_capacity ?? 0},
				{label: t('welcome_wca.stat_events'), value: stats.supported_event_count ?? 0},
				{label: t('welcome_wca.stat_languages'), value: stats.supported_language_count ?? 0},
		  ]
		: [];

	return (
		<section className={b()}>
			<div className={b('background')}>
				<div className={b('orb', {position: 'top'})} />
				<div className={b('orb', {position: 'bottom'})} />
			</div>

			<div className={b('container')}>
				{/* Header */}
				<motion.div
					className={b('header')}
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{once: true, amount: 0.3}}
				>
					<motion.div className={b('eyebrow')} variants={fadeInUp}>
						<Trophy size={18} weight="duotone" />
						<span>{t('welcome_wca.eyebrow')}</span>
					</motion.div>
					<motion.h2 className={b('title')} variants={fadeInUp}>
						{t('welcome_wca.title')}
					</motion.h2>
					<motion.p className={b('subtitle')} variants={fadeInUp}>
						{t('welcome_wca.subtitle')}
					</motion.p>
				</motion.div>

				{/* Showcase: hero image + feature bullets */}
				<div className={b('showcase')}>
					<motion.div
						className={b('image-wrap')}
						initial={{opacity: 0, x: -40}}
						whileInView={{opacity: 1, x: 0}}
						viewport={{once: true, amount: 0.2}}
						transition={{duration: 0.7, ease: [0.22, 1, 0.36, 1]}}
					>
						<img
							src="/public/welcome/web/wca_comp.jpg"
							alt={t('welcome_wca.image_alt')}
							className={b('image')}
							loading="lazy"
						/>
						<div className={b('image-glow')} />
						<div className={b('image-badge')}>
							<span className={b('image-badge-dot')} />
							{t('welcome_wca.image_badge_live')}
						</div>
					</motion.div>

					<motion.div
						className={b('features')}
						variants={staggerContainer}
						initial="hidden"
						whileInView="visible"
						viewport={{once: true, amount: 0.2}}
					>
						{FEATURES.map((f) => {
							const Icon = FEATURE_ICONS[f.iconIdx];
							return (
								<motion.div key={f.key} className={b('feature')} variants={fadeInUp}>
									<div className={b('feature-icon')}>
										<Icon size={18} weight="duotone" />
									</div>
									<div className={b('feature-body')}>
										<h4 className={b('feature-title')}>
											{t(`welcome_wca.feat_${f.key}_title`)}
										</h4>
										<p className={b('feature-desc')}>{t(`welcome_wca.feat_${f.key}_desc`)}</p>
									</div>
								</motion.div>
							);
						})}
					</motion.div>
				</div>

				{/* Upcoming competition cards */}
				<motion.div
					className={b('grid-header')}
					initial={{opacity: 0, y: 20}}
					whileInView={{opacity: 1, y: 0}}
					viewport={{once: true, amount: 0.3}}
					transition={{duration: 0.5}}
				>
					<h3 className={b('grid-title')}>{t('welcome_wca.upcoming_title')}</h3>
					<span className={b('grid-hint')}>{t('welcome_wca.upcoming_hint')}</span>
				</motion.div>

				<div className={b('grid')}>
					{competitions === null && [0, 1, 2, 3].map((i) => (
						<div key={i} className={b('card', {skeleton: true})} aria-hidden />
					))}

					{competitions && competitions.length === 0 && (
						<div className={b('empty')}>
							<Cube size={32} weight="duotone" />
							<span>{t('welcome_wca.empty')}</span>
						</div>
					)}

					{competitions && competitions.slice(0, 4).map((c) => (
						<motion.a
							key={c.id}
							href={`/community/competitions/${c.id}`}
							className={b('card')}
							initial={{opacity: 0, y: 20}}
							animate={{opacity: 1, y: 0}}
							transition={{duration: 0.4, ease: [0.22, 1, 0.36, 1]}}
							whileHover={hoverLift}
							whileTap={tapScale}
						>
							<div className={b('card-top')}>
								<div className={b('card-badge')}>
									<Broadcast size={14} weight="fill" />
									<span>WCA</span>
								</div>
								<div className={b('card-country')}>{c.country_iso2}</div>
							</div>
							<h3 className={b('card-name')}>{c.name}</h3>
							<div className={b('card-meta')}>
								<div className={b('card-meta-row')}>
									<CalendarBlank size={14} weight="duotone" />
									<span>{formatDateRange(c.start_date, c.end_date, lang)}</span>
								</div>
								<div className={b('card-meta-row')}>
									<MapPin size={14} weight="duotone" />
									<span>{c.city}</span>
								</div>
							</div>
							<div className={b('card-events')}>
								{(c.event_ids || []).slice(0, 6).map((ev) => (
									<span key={ev} className={b('card-event')}>{ev}</span>
								))}
								{c.event_ids && c.event_ids.length > 6 && (
									<span className={b('card-event', {more: true})}>+{c.event_ids.length - 6}</span>
								)}
							</div>
						</motion.a>
					))}
				</div>

				{/* Stats counters */}
				<div ref={statsRef as any} className={b('stats')}>
					{stats && STATS.map((s, i) => (
						<StatCounter
							key={i}
							label={s.label}
							target={s.value}
							active={statsInView}
						/>
					))}
				</div>

				{/* CTA */}
				<motion.div
					className={b('cta')}
					initial={{opacity: 0, y: 20}}
					whileInView={{opacity: 1, y: 0}}
					viewport={{once: true}}
					transition={{duration: 0.5}}
				>
					<Button
						large
						primary
						glow
						onClick={() => (window.location.href = '/community/competitions')}
					>
						{t('welcome_wca.cta')}
						<ArrowRight size={18} weight="bold" style={{marginLeft: '0.5rem'}} />
					</Button>
				</motion.div>
			</div>
		</section>
	);
}
