import React from 'react';
import './Admin.scss';
import block from '../../styles/bem';
import PageTitle from '../common/page_title/PageTitle';
import {Link} from 'react-router-dom';
import {SquaresFour, CaretDown, CaretRight} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useMe} from '../../util/hooks/useMe';

const b = block('admin');

const PANO_TAB = {id: 'dashboard', link: '/admin/dashboard', value: 'Pano'};

const SECONDARY_TABS = [
	{id: 'reports', link: '/admin/reports', value: 'Reports'},
	{id: 'users', link: '/admin/users', value: 'Users'},
	{id: 'pro-users', link: '/admin/pro-users', value: 'Pro Users'},
	{id: 'announcements', link: '/admin/announcements', value: 'Announcements'},
	{id: 'email', link: '/admin/email', value: 'Mail'},
	{id: 'algorithms', link: '/admin/algorithms', value: 'Algorithms'},
	{id: 'promo-codes', link: '/admin/promo-codes', value: 'Promo'},
	{id: 'site-config', link: '/admin/site-config', value: 'Site Config'},
];

interface Props {
	path: string;
	children: React.ReactNode;
}

export default function Admin(props: Props) {
	const {path, children} = props;
	const page = path.split('/')[2];
	const me = useMe();
	const {t} = useTranslation();
	const [open, setOpen] = React.useState(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (!open) return;
		function handleClickOutside(e: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function handleEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') setOpen(false);
		}
		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [open]);

	// Competition management moved to the standalone /organizer pages; mods no
	// longer reach /admin/* at all (see server/router.tsx), so admin-only here.
	if (!me?.admin) {
		return null;
	}

	const isPanoActive = page === PANO_TAB.id;
	const activeSecondary = SECONDARY_TABS.find((tab) => tab.id === page);
	const triggerLabel = activeSecondary?.value || t('admin_nav.other_pages');

	return (
		<div className={b()}>
			<PageTitle pageName="Admin">
				<div className={b('nav-grid')}>
					<Link
						to={PANO_TAB.link}
						className={b('pano-card', {active: isPanoActive})}
					>
						<div className={b('pano-icon')}>
							<SquaresFour size={24} weight="bold" />
						</div>
						<div className={b('pano-label')}>{PANO_TAB.value}</div>
					</Link>

					<div className={b('dropdown')} ref={dropdownRef}>
						<button
							type="button"
							className={b('dropdown-trigger', {open, has_active: !!activeSecondary})}
							onClick={() => setOpen((v) => !v)}
						>
							<span className={b('dropdown-trigger-label')}>{triggerLabel}</span>
							<CaretDown
								size={16}
								weight="bold"
								className={b('dropdown-trigger-caret', {open})}
							/>
						</button>

						{open && (
							<div className={b('dropdown-panel')}>
								{SECONDARY_TABS.map((tab) => {
									const active = page === tab.id;
									return (
										<Link
											key={tab.id}
											to={tab.link}
											className={b('dropdown-item', {active})}
											onClick={() => setOpen(false)}
										>
											<span className={b('dropdown-item-label')}>{tab.value}</span>
											<CaretRight size={14} weight="bold" className={b('dropdown-item-caret')} />
										</Link>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</PageTitle>
			{children}
		</div>
	);
}
