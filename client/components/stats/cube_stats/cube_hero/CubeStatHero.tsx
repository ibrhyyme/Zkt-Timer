import React, {ReactNode, useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './CubeStatHero.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {getCubeTypeBucketLabel} from '../../../../util/cubes/util';
import {getCurrentAverage} from '../../../../db/solves/stats/solves/average/average';
import {getTotalSolveCount} from '../../../../db/solves/stats/count';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getTimeString} from '../../../../util/time';
import MobileNav from '../../../layout/nav/mobile_nav/MobileNav';
import AccountDropdown from '../../../layout/nav/account_dropdown/AccountDropdown';

const b = block('cube-hero');

interface Props {
	children?: ReactNode;
}

export default function CubeStatHero(props: Props) {
	const {children} = props;
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const cubeLabel = useMemo(() => {
		const ct = (filterOptions.cube_type as string) || '';
		const subset = (filterOptions.scramble_subset ?? null) as string | null;
		return getCubeTypeBucketLabel(ct, subset);
	}, [filterOptions]);

	const totalSolves = useMemo(() => getTotalSolveCount(filterOptions), [filterOptions, solveUpdate]);
	const avgAo12 = useMemo(() => getCurrentAverage(filterOptions, 12), [filterOptions, solveUpdate]);

	return (
		<div className={b()}>
			<div className={b('top')}>
				<div className={b('left')}>
					<div className={b('glyph')} aria-hidden="true">
						<svg viewBox="0 0 60 60">
							<defs>
								<linearGradient id="cube-shade" x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stopColor="rgb(var(--primary-color))" />
									<stop offset="100%" stopColor="rgb(var(--secondary-color))" />
								</linearGradient>
							</defs>
							<g stroke="rgba(255,255,255,0.65)" strokeWidth="1.2" fill="url(#cube-shade)">
								<polygon points="10,18 30,8 50,18 30,28" opacity="0.95" />
								<polygon points="10,18 30,28 30,52 10,42" opacity="0.7" />
								<polygon points="50,18 30,28 30,52 50,42" opacity="0.85" />
								<line x1="16.7" y1="14.7" x2="36.7" y2="24.7" />
								<line x1="23.3" y1="11.3" x2="43.3" y2="21.3" />
								<line x1="23.3" y1="24.7" x2="43.3" y2="14.7" />
								<line x1="16.7" y1="21.3" x2="36.7" y2="11.3" />
								<line x1="16.7" y1="21.3" x2="16.7" y2="45.3" />
								<line x1="23.3" y1="24.7" x2="23.3" y2="48.7" />
								<line x1="10" y1="26" x2="30" y2="36" />
								<line x1="10" y1="34" x2="30" y2="44" />
								<line x1="43.3" y1="21.3" x2="43.3" y2="45.3" />
								<line x1="36.7" y1="24.7" x2="36.7" y2="48.7" />
								<line x1="50" y1="26" x2="30" y2="36" />
								<line x1="50" y1="34" x2="30" y2="44" />
							</g>
						</svg>
					</div>
					<div className={b('text')}>
						<h1 className={b('title')}>
							{cubeLabel} <span className={b('title-suffix')}>{t('stats.page_title')}</span>
							<span className={b('mobile-cluster')}>
								<MobileNav />
								<span className={b('account-dropdown-mobile')}>
									<AccountDropdown />
								</span>
							</span>
						</h1>
						<div className={b('meta')}>
							{totalSolves > 0 && (
								<span className={b('pill')}>
									{t('stats.cube_hero.solves_count', {value: totalSolves.toLocaleString()})}
								</span>
							)}
							{avgAo12?.time != null && (
								<span className={b('pill')}>
									{t('stats.cube_hero.avg_ao12', {time: getTimeString(avgAo12.time)})}
								</span>
							)}
						</div>
						<div className={b('lines')}>
							<div className={b('line')} />
							<div className={b('line', {secondary: true})} />
						</div>
					</div>
				</div>
				{children ? <div className={b('filters')}>{children}</div> : null}
			</div>
		</div>
	);
}
