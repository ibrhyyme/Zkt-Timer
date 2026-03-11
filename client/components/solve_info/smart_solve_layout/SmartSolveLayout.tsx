import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cube, Bluetooth, Timer, ArrowCounterClockwise, ArrowsClockwise } from 'phosphor-react';
import HorizontalNav from '../../common/horizontal_nav/HorizontalNav';
import ScrambleVisual from '../../modules/scramble/ScrambleVisual';
import SolutionInfo from '../solution_info/SolutionInfo';
import SmartOverviewTab from '../stats_info/smart_overview_tab/SmartOverviewTab';
import StepsTable from '../stats_info/steps_table/StepsTable';
import NotesInfo from '../notes_info/NotesInfo';
import Avatar from '../../common/avatar/Avatar';
import Button from '../../common/button/Button';
import Tag from '../../common/tag/Tag';
import CopyText from '../../common/copy_text/CopyText';
import block from '../../../styles/bem';
import { getFullFormattedDate } from '../../../util/dates';
import { SolveLayoutProps } from '../SolveInfo';
import './SmartSolveLayout.scss';

const b = block('solve-info');
const bs = block('solve-info-smart');

export default function SmartSolveLayout(props: SolveLayoutProps) {
	const {
		solve, effSolve, user, disabled, editMode, mobileMode,
		toggleEditMode, togglePlusTwo, toggleDnf, deleteSolve,
		handleChange, handleDone,
		time, cubeTypeInfo, endedAt, isSystemDnf, plusTwo, dnf, smartDevice,
	} = props;

	const { t } = useTranslation();
	const [page, setPage] = useState('overview');

	const rawTime = solve.raw_time;
	const smartTurnCount = solve.smart_turn_count;
	const smartInspectionTime = solve.inspection_time;
	const tps = (smartTurnCount / rawTime).toFixed(2);

	const scramble = solve.scramble;
	const cubeType = solve.cube_type;

	let shareLink = null;
	if (typeof window !== 'undefined') {
		shareLink = (
			<CopyText
				buttonProps={{ text: t('solve_info.share_link') }}
				text={window.location.origin + '/solve/' + solve.share_code}
			/>
		);
	}

	let editButton = (
		<Button
			text={editMode ? t('solve_info.save') : t('solve_info.edit')}
			className={b('edit')}
			gray
			primary={editMode}
			onClick={toggleEditMode}
		/>
	);

	let plusTwoButton = <Button gray text="+2" disabled={disabled || isSystemDnf} onClick={togglePlusTwo} warning={plusTwo} />;
	let dnfButton = <Button gray text="DNF" disabled={disabled || isSystemDnf} onClick={toggleDnf} danger={dnf} />;
	let deleteButton = <Button gray title={t('solve_info.delete')} text={t('solve_info.delete')} onClick={deleteSolve} />;

	if (disabled) {
		deleteButton = null;
		editButton = null;
		plusTwoButton = null;
		dnfButton = null;

		if (plusTwo) {
			plusTwoButton = <Tag text="+2" backgroundColor="orange" />;
		}
		if (dnf) {
			dnfButton = <Tag text="DNF" backgroundColor="red" />;
		}
	}

	const childBody = {
		editMode,
		solve,
		handleChange,
	};

	const pageMap = {
		overview: <SmartOverviewTab solve={solve} />,
		stats: <StepsTable solve={solve} />,
		solution: <SolutionInfo {...childBody} />,
		notes: <NotesInfo {...childBody} />,
	};

	const pages = [
		{ id: 'overview', value: t('solve_info.overview_tab') },
		{ id: 'stats', value: t('solve_info.stats_tab') },
		{ id: 'solution', value: t('solve_info.solve_tab') },
		{ id: 'notes', value: t('solve_info.notes_tab') },
	];

	return (
		<div className={b({ mobile: mobileMode, smart: true })}>
			{mobileMode && (
				<div className={b('mobile-header-top')}>
					<div className={b('mobile-title')}>{t('solve_info.solve_detail')}</div>
					<div className={b('mobile-done')} onClick={handleDone}>{t('solve_info.done')}</div>
				</div>
			)}
			{!mobileMode && (
				<div className={b('web-done')} onClick={handleDone}>{t('solve_info.done')}</div>
			)}
			<div className={b('top-actions')}>
				<div>{shareLink}</div>
				<div>
					{deleteButton}
					{editButton}
				</div>
			</div>

			<h2 className={bs('time')}>{time}</h2>
			<div className={b('date-info')}>
				<span>{getFullFormattedDate(endedAt)}</span>
			</div>

			<div className={bs('header')}>
				<div className={bs('header-info')}>
					<Avatar small user={user} hideBadges profile={user?.profile} />
					<div className={b('sub-actions')}>
						<Tag
							icon={<Bluetooth />}
							text={smartDevice?.name}
							title="Smart cube"
							large
							backgroundColor="blue"
						/>
						<Tag icon={<Cube weight="bold" />} backgroundColor="button" text={cubeTypeInfo.name} />
						{plusTwoButton}
						{dnfButton}
					</div>
				</div>
				<div className={bs('header-visual')}>
					<ScrambleVisual cubeType={cubeType} scramble={scramble} />
				</div>
			</div>

			<div className={bs('summary-cards')}>
				<div className={bs('card')}>
					<h4>{smartInspectionTime ? smartInspectionTime + 's' : '-'}</h4>
					<div className={bs('card-label')}>
						<Timer />
						<span>{t('solve_info.inspection')}</span>
					</div>
				</div>
				<div className={bs('card')}>
					<h4>{smartTurnCount}</h4>
					<div className={bs('card-label')}>
						<ArrowCounterClockwise />
						<span>{t('solve_info.turns')}</span>
					</div>
				</div>
				<div className={bs('card')}>
					<h4>{tps}</h4>
					<div className={bs('card-label')}>
						<ArrowsClockwise />
						<span>{t('solve_info.tps')}</span>
					</div>
				</div>
			</div>

			<div className={bs('scramble-row')}>
				<p className={bs('scramble-text')}>
					<span>{t('solve_info.scramble_label')}:</span> {scramble}
				</p>
				<CopyText
					text={scramble}
					buttonProps={{ text: '' }}
				/>
			</div>

			<div className={b('nav')}>
				<HorizontalNav tabId={page} onChange={setPage} tabs={pages} />
			</div>
			{pageMap[page]}
		</div>
	);
}
