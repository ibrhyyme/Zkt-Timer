import React from 'react';
import {useTranslation} from 'react-i18next';
import {Timer, Cube, Bluetooth} from 'phosphor-react';
import './StatsViewToggle.scss';
import block from '../../../../styles/bem';

const b = block('stats-view-toggle');

export type StatsView = 'all' | 'smart';

interface Props {
	view: StatsView;
	onChange: (view: StatsView) => void;
	allCount: number;
	smartCount: number;
}

function formatCount(n: number): string {
	return n.toLocaleString();
}

export default function StatsViewToggle({view, onChange, allCount, smartCount}: Props) {
	const {t} = useTranslation();

	return (
		<div className={b()} data-mode={view}>
			<div className={b('glow')} />
			<div className={b('track')}>
				<button
					type="button"
					className={b('seg', {active: view === 'all'})}
					onClick={() => onChange('all')}
				>
					<span className={b('seg-icon')}>
						<Timer weight="bold" size={18} />
					</span>
					<span className={b('seg-text')}>
						<span className={b('seg-title')}>{t('stats_page.view_all')}</span>
						<span className={b('seg-sub')}>{t('stats_page.view_all_sub')}</span>
					</span>
					<span className={b('seg-count')}>{formatCount(allCount)}</span>
				</button>

				<button
					type="button"
					className={b('seg', {active: view === 'smart'})}
					onClick={() => onChange('smart')}
				>
					<span className={b('seg-icon')}>
						<Cube weight="bold" size={18} />
					</span>
					<span className={b('seg-text')}>
						<span className={b('seg-title')}>
							{t('stats_page.view_smart_cube')}
							<span className={b('seg-live')}>
								<Bluetooth weight="bold" size={9} />
							</span>
						</span>
						<span className={b('seg-sub')}>{t('stats_page.view_smart_cube_sub')}</span>
					</span>
					<span className={b('seg-count')}>{formatCount(smartCount)}</span>
				</button>

				<span className={b('thumb')} aria-hidden="true" />
			</div>
		</div>
	);
}
