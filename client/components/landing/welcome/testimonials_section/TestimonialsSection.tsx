import React from 'react';
import {useTranslation} from 'react-i18next';
import {motion} from 'framer-motion';
import {Quotes, Star} from 'phosphor-react';
import block from '../../../../styles/bem';
import {staggerContainer, fadeInUp} from '../motion-variants';
import './TestimonialsSection.scss';

const b = block('welcome-testimonials');

interface Testimonial {
	quoteKey: string;
	name: string;
	roleKey: string;
	avatar: string;
	accent: 'blue' | 'purple' | 'amber';
}

const TESTIMONIALS: Testimonial[] = [
	{
		quoteKey: 'welcome_testimonials.t1_quote',
		name: 'Kerem A.',
		roleKey: 'welcome_testimonials.t1_role',
		avatar: 'KA',
		accent: 'blue',
	},
	{
		quoteKey: 'welcome_testimonials.t2_quote',
		name: 'Sude K.',
		roleKey: 'welcome_testimonials.t2_role',
		avatar: 'SK',
		accent: 'purple',
	},
	{
		quoteKey: 'welcome_testimonials.t3_quote',
		name: 'Emir T.',
		roleKey: 'welcome_testimonials.t3_role',
		avatar: 'ET',
		accent: 'amber',
	},
];

export default function TestimonialsSection() {
	const {t} = useTranslation();

	return (
		<section className={b()}>
			<div className={b('background')}>
				<div className={b('orb')} />
			</div>

			<div className={b('container')}>
				<motion.div
					className={b('header')}
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{once: true, amount: 0.3}}
				>
					<motion.div className={b('eyebrow')} variants={fadeInUp}>
						<Star size={16} weight="fill" />
						<span>{t('welcome_testimonials.eyebrow')}</span>
					</motion.div>
					<motion.h2 className={b('title')} variants={fadeInUp}>
						{t('welcome_testimonials.title')}
					</motion.h2>
				</motion.div>

				<motion.div
					className={b('grid')}
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{once: true, amount: 0.15}}
				>
					{TESTIMONIALS.map((ts) => (
						<motion.div
							key={ts.name}
							className={b('card', {accent: ts.accent})}
							variants={fadeInUp}
						>
							<div className={b('quote-icon')}>
								<Quotes size={28} weight="fill" />
							</div>

							<div className={b('stars')}>
								{[0, 1, 2, 3, 4].map((i) => (
									<Star key={i} size={16} weight="fill" />
								))}
							</div>

							<p className={b('quote')}>{t(ts.quoteKey)}</p>

							<div className={b('author')}>
								<div className={b('avatar', {accent: ts.accent})}>{ts.avatar}</div>
								<div className={b('author-meta')}>
									<span className={b('author-name')}>{ts.name}</span>
									<span className={b('author-role')}>{t(ts.roleKey)}</span>
								</div>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
