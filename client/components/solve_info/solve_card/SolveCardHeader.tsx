import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cube } from 'phosphor-react';
import Avatar from '../../common/avatar/Avatar';
import Button from '../../common/button/Button';
import Tag from '../../common/tag/Tag';
import ScrambleVisual from '../../modules/scramble/ScrambleVisual';
import block from '../../../styles/bem';
import { getFullFormattedDate } from '../../../util/dates';
import { SolveLayoutProps } from '../SolveInfo';
import SolveActions from '../solve_actions/SolveActions';
import './SolveCard.scss';

const b = block('solve-card');

interface Props {
	layout: SolveLayoutProps;
	/** Each layout's own rule for who may hand out the link. */
	canShareLink: boolean;
	/** Whether the card has anything to edit, and so an Edit button. */
	editable?: boolean;
}

/**
 * The top of a solve card, the same for a normal and a smart cube solve: the title bar, then
 * the time with what it means and one line of who, what and when beside a small scramble
 * cube, then the penalties and the actions. One block instead of the boxed rows it replaced
 * (actions, time, date, a tag box, a 250px cube), which pushed the solve itself off a phone's
 * first screen.
 */
export default function SolveCardHeader({ layout, canShareLink, editable = true }: Props) {
	const {
		solve, user, disabled, editMode, toggleEditMode, togglePlusTwo, toggleDnf, deleteSolve, handleDone,
		time, cubeTypeInfo, endedAt, isSystemDnf, plusTwo, dnf, cubeTag, standing,
	} = layout;
	const { t } = useTranslation();

	const visualCubeType = solve.cube_type === 'wca' && solve.scramble_subset ? solve.scramble_subset : solve.cube_type;

	// Someone else's solve (or a shared link) shows a penalty it carries, without the toggles.
	let penalty: React.ReactNode;
	if (disabled) {
		penalty = (
			<>
				{plusTwo && <Tag text="+2" backgroundColor="orange" />}
				{dnf && <Tag text="DNF" backgroundColor="red" />}
			</>
		);
	} else {
		penalty = (
			<>
				<Button small gray text="+2" disabled={isSystemDnf} onClick={togglePlusTwo} warning={plusTwo} />
				<Button small gray text="DNF" disabled={isSystemDnf} onClick={toggleDnf} danger={dnf} />
			</>
		);
	}

	return (
		<>
			<div className={b('bar')}>
				<span className={b('title')}>{t('solve_info.solve_detail')}</span>
				<button type="button" className={b('done')} onClick={handleDone}>
					{t('solve_info.done')}
				</button>
			</div>

			<div className={b('head')}>
				<div className={b('head-main')}>
					<h2 className={b('time')}>{time}</h2>
					{standing}
					<div className={b('meta')}>
						<Avatar small user={user} hideBadges profile={user?.profile} />
						<Tag icon={<Cube weight="bold" />} backgroundColor="button" text={cubeTypeInfo?.name} />
						{cubeTag}
						<span className={b('date')}>{getFullFormattedDate(endedAt)}</span>
					</div>
				</div>
				<div className={b('visual')}>
					<ScrambleVisual cubeType={visualCubeType} scramble={solve.scramble} subset={solve.scramble_subset || undefined} />
				</div>
			</div>

			<div className={b('toolbar')}>
				<div className={b('penalty')}>{penalty}</div>
				<SolveActions
					solve={solve}
					canShareLink={canShareLink}
					disabled={disabled}
					editMode={editMode}
					editable={editable}
					shareTitle={`${cubeTypeInfo?.name} - ${time} | Zkt Timer`}
					toggleEditMode={toggleEditMode}
					deleteSolve={deleteSolve}
				/>
			</div>
		</>
	);
}
