import React from 'react';
import { useHistory } from 'react-router-dom';
import './WelcomeFooter.scss';
import block from '../../../../styles/bem';
import { InstagramLogo, YoutubeLogo } from 'phosphor-react';

const b = block('welcome-footer');

export default function WelcomeFooter() {
	const history = useHistory();

	return (
		<footer className={b()}>
			<div className={b('container')}>
				{/* Social Media Section */}
				<div className={b('cta-card')}>
					<h2 className={b('cta-title')}>Topluluğumuza Katılın</h2>
					<p className={b('cta-description')}>
						Sosyal medyada bizi takip edin, yeni içeriklerden haberdar olun ve speedcubing topluluğunun bir parçası olun!
					</p>

					<div className={b('social-grid')}>
						{/* Instagram Accounts */}
						<div className={b('social-category')}>
							<h3 className={b('social-category-title')}>
								<InstagramLogo size={24} weight="fill" />
								Instagram
							</h3>
							<div className={b('social-links')}>
								<a
									href="https://www.instagram.com/zekakuputurkiye/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Zeka Küpü Türkiye</span>
										<span className={b('social-link-handle')}>@zekakuputurkiye</span>
									</div>
								</a>
								<a
									href="https://www.instagram.com/mertsagdinc/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Mert Sağdınç</span>
										<span className={b('social-link-handle')}>@mertsagdinc</span>
									</div>
								</a>
								<a
									href="https://www.instagram.com/isoq58/"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<InstagramLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İskender Aznavur</span>
										<span className={b('social-link-handle')}>@isoq58</span>
									</div>
								</a>
							</div>
						</div>

						{/* YouTube Channels */}
						<div className={b('social-category')}>
							<h3 className={b('social-category-title')}>
								<YoutubeLogo size={24} weight="fill" />
								YouTube
							</h3>
							<div className={b('social-links')}>
								<a
									href="https://www.youtube.com/@ibrhyyme"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İbrahim Yıldız</span>
										<span className={b('social-link-handle')}>@ibrhyyme</span>
									</div>
								</a>
								<a
									href="https://www.youtube.com/@AlgoMert"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>Mert Sağdınç</span>
										<span className={b('social-link-handle')}>@AlgoMert</span>
									</div>
								</a>
								<a
									href="https://www.youtube.com/@isoq58/videos"
									target="_blank"
									rel="noopener noreferrer"
									className={b('social-link')}
								>
									<YoutubeLogo size={32} weight="duotone" />
									<div className={b('social-link-text')}>
										<span className={b('social-link-name')}>İskender Aznavur</span>
										<span className={b('social-link-handle')}>@isoq58</span>
									</div>
								</a>
							</div>
						</div>
					</div>
				</div>

				{/* Footer Links */}
				<div className={b('links')}>
					<div className={b('copyright')}>
						© {new Date().getFullYear()} ZKT-Timer. Created and Designed by{' '}
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
							Privacy
						</a>
						<a onClick={() => history.push('/terms')} className={b('nav-link')}>
							Terms
						</a>
						<a onClick={() => history.push('/credits')} className={b('nav-link')}>
							Credits
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
