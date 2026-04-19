import React from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import './WelcomeFooter.scss';
import block from '../../../../styles/bem';
import { InstagramLogo, YoutubeLogo } from 'phosphor-react';
import { fadeInUp, staggerContainer, hoverScaleSubtle, tapScale } from '../motion-variants';

const b = block('welcome-footer');

export default function WelcomeFooter() {
	const history = useHistory();
	const { t } = useTranslation();

	return (
		<footer className={b()}>
			<div className={b('container')}>
				{/* Social Media Section */}
				<motion.div
					className={b('cta-card')}
					variants={staggerContainer}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
				>
					<motion.h2 className={b('cta-title')} variants={fadeInUp}>
						{t('welcome_footer.cta_title')}
					</motion.h2>
					<motion.p className={b('cta-description')} variants={fadeInUp}>
						{t('welcome_footer.cta_description')}
					</motion.p>

					<motion.div className={b('social-grid')} variants={fadeInUp}>
						{/* Instagram Accounts */}
						<div className={b('social-category')}>
							<h3 className={b('social-category-title')}>
								<InstagramLogo size={24} weight="fill" />
								Instagram
							</h3>
							<div className={b('social-links')}>
								<motion.a
									href="https://www.instagram.com/zekakuputurkiye/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Zeka Küpü Türkiye</span>
										<span className={b('social-link-handle')}>@zekakuputurkiye</span>
									</div>
								</motion.a>
								<motion.a
									href="https://www.instagram.com/mertsagdinc/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Mert Sağdınç</span>
										<span className={b('social-link-handle')}>@mertsagdinc</span>
									</div>
								</motion.a>
								<motion.a
									href="https://www.instagram.com/isoq58/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İskender Aznavur</span>
										<span className={b('social-link-handle')}>@isoq58</span>
									</div>
								</motion.a>
							</div>
						</div>

						{/* YouTube Channels */}
						<div className={b('social-category')}>
							<h3 className={b('social-category-title')}>
								<YoutubeLogo size={24} weight="fill" />
								YouTube
							</h3>
							<div className={b('social-links')}>
								<motion.a
									href="https://www.youtube.com/@ibrhyyme"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İbrahim Yıldız</span>
										<span className={b('social-link-handle')}>@ibrhyyme</span>
									</div>
								</motion.a>
								<motion.a
									href="https://www.youtube.com/@AlgoMert"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Mert Sağdınç</span>
										<span className={b('social-link-handle')}>@AlgoMert</span>
									</div>
								</motion.a>
								<motion.a
									href="https://www.youtube.com/@isoq58/videos"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
									whileHover={hoverScaleSubtle}
									whileTap={tapScale}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İskender Aznavur</span>
										<span className={b('social-link-handle')}>@isoq58</span>
									</div>
								</motion.a>
							</div>
						</div>
					</motion.div>
				</motion.div>

				{/* Internal SEO links — crawlers discover & rank these via anchor text */}
				<nav className={b('sitemap')} aria-label="Site">
					<Link to="/timer" className={b('nav-link')}>{t('seo.nav_timer_name')}</Link>
					<Link to="/trainer" className={b('nav-link')}>{t('seo.nav_trainer_name')}</Link>
					<Link to="/rooms" className={b('nav-link')}>{t('seo.nav_rooms_name')}</Link>
					<Link to="/community/competitions" className={b('nav-link')}>{t('seo.nav_competitions_name')}</Link>
					<Link to="/ranks" className={b('nav-link')}>{t('seo.nav_leaderboards_name')}</Link>
					<Link to="/battle" className={b('nav-link')}>{t('seo.nav_battle_name')}</Link>
					<Link to="/pro" className={b('nav-link')}>{t('seo.nav_pro_name')}</Link>
					<Link to="/signup" className={b('nav-link')}>{t('seo.nav_signup_name')}</Link>
				</nav>

				{/* Footer Links */}
				<div className={b('links')}>
					<div className={b('copyright')}>
						{t('welcome_footer.copyright', { year: new Date().getFullYear() })}{' '}
						<a
							href="/user/ibrhyyme"
							target="_blank"
							rel="noopener noreferrer"
							style={{ color: '#246bfd', textDecoration: 'none', fontWeight: 600 }}
						>
							ibrhyyme
						</a>
					</div>
					<div className={b('nav')}>
						<a onClick={() => history.push('/privacy')} className={b('nav-link')}>
							{t('welcome_footer.privacy')}
						</a>
						<a onClick={() => history.push('/terms')} className={b('nav-link')}>
							{t('welcome_footer.terms')}
						</a>
						<a onClick={() => history.push('/credits')} className={b('nav-link')}>
							{t('welcome_footer.credits')}
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
