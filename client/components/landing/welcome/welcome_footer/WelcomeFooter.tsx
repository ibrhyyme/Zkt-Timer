import React from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import './WelcomeFooter.scss';
import block from '../../../../styles/bem';
import { ArrowUpRight, InstagramLogo, YoutubeLogo } from 'phosphor-react';
import { fadeInUp, staggerContainer } from '../motion-variants';
import NotationHeading from '../notation_heading/NotationHeading';
import { STICKER, Face, stickerTint } from '../landing-data';

const b = block('welcome-footer');

type Network = 'instagram' | 'youtube';

interface Person {
	name: string;
	face: Face;
	accounts: { network: Network; handle: string; href: string }[];
}

// The people behind the app and their real accounts, nothing more: no roles or photos
// are made up for them. Each gets a sticker colour for the row.
const PEOPLE: Person[] = [
	{
		name: 'Zeka Küpü Türkiye',
		face: 'F',
		accounts: [{ network: 'instagram', handle: '@zekakuputurkiye', href: 'https://www.instagram.com/zekakuputurkiye/' }],
	},
	{
		name: 'Zkt Timer',
		face: 'B',
		accounts: [{ network: 'instagram', handle: '@zkttimer', href: 'https://www.instagram.com/zkttimer' }],
	},
	{
		name: 'İbrahim Yıldız',
		face: 'L',
		accounts: [
			{ network: 'instagram', handle: '@ibrhyyme', href: 'https://www.instagram.com/ibrhyyme' },
			{ network: 'youtube', handle: '@ibrhyyme', href: 'https://www.youtube.com/@ibrhyyme' },
		],
	},
];

const NETWORK = {
	instagram: { label: 'Instagram', Icon: InstagramLogo },
	youtube: { label: 'YouTube', Icon: YoutubeLogo },
};

export default function WelcomeFooter() {
	const history = useHistory();
	const { t } = useTranslation();

	return (
		<footer className={b()}>
			<div className={b('container')}>
				{/* Who we are: the people and their accounts, one row each. */}
				<div className={b('community')}>
					<div className={b('intro')}>
						<NotationHeading className={b('title')} text={t('welcome_footer.cta_title')} />
						<p className={b('description')}>{t('welcome_footer.cta_description')}</p>
					</div>

					<motion.ul
						className={b('people')}
						variants={staggerContainer}
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true, amount: 0.3 }}
					>
						{PEOPLE.map((person) => (
							<motion.li
								key={person.name}
								className={b('person')}
								variants={fadeInUp}
								style={
									{
										'--face': STICKER[person.face],
										'--tint': stickerTint(person.face),
									} as React.CSSProperties
								}
							>
								<span className={b('sticker')} aria-hidden="true" />
								<span className={b('person-name')}>{person.name}</span>
								<span className={b('accounts')}>
									{person.accounts.map(({ network, handle, href }) => {
										const { label, Icon } = NETWORK[network];
										return (
											<a
												key={href}
												href={href}
												target="_blank"
												rel="noopener noreferrer"
												className={b('account', { network })}
												aria-label={`${label} ${handle}`}
											>
												<Icon size={18} weight="bold" aria-hidden="true" />
												<span className={b('account-handle')}>{handle}</span>
												<ArrowUpRight size={14} weight="bold" aria-hidden="true" className={b('account-arrow')} />
											</a>
										);
									})}
								</span>
							</motion.li>
						))}
					</motion.ul>
				</div>

				{/* Internal SEO links — crawlers discover & rank these via anchor text */}
				<nav className={b('sitemap')} aria-label="Site">
					<Link to="/timer" className={b('nav-link')}>{t('seo.nav_timer_name')}</Link>
					<Link to="/trainer" className={b('nav-link')}>{t('seo.nav_trainer_name')}</Link>
					<Link to="/rooms" className={b('nav-link')}>{t('seo.nav_rooms_name')}</Link>
					<Link to="/competitions" className={b('nav-link')}>{t('seo.nav_competitions_name')}</Link>
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
							className={b('author')}
						>
							ibrhyyme
						</a>
					</div>
					<div className={b('nav')}>
						<a onClick={() => history.push('/help')} className={b('nav-link')}>
							{t('welcome_footer.help')}
						</a>
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
