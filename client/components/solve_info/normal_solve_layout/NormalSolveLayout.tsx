import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { Cube, ShareNetwork } from 'phosphor-react';
import { openModal } from '../../../actions/general';
import ScrambleVisual from '../../modules/scramble/ScrambleVisual';
import TextArea from '../../common/inputs/textarea/TextArea';
import HistoryModal from '../../modules/history/history_modal/HistoryModal';
import Avatar from '../../common/avatar/Avatar';
import Button from '../../common/button/Button';
import Tag from '../../common/tag/Tag';
import CopyText from '../../common/copy_text/CopyText';
import block from '../../../styles/bem';
import { useInput } from '../../../util/hooks/useInput';
import { getFullFormattedDate } from '../../../util/dates';
import { SolveLayoutProps } from '../SolveInfo';
import { shareContent } from '../../../util/native-plugins';
import { canSync } from '../../../lib/sync-gate';
import './NormalSolveLayout.scss';

const b = block('solve-info');

export default function NormalSolveLayout(props: SolveLayoutProps) {
	const {
		solve, effSolve, user, disabled, editMode, mobileMode,
		toggleEditMode, togglePlusTwo, toggleDnf, deleteSolve,
		handleChange, handleDone, onComplete,
		time, cubeTypeInfo, endedAt, isSystemDnf, plusTwo, dnf,
	} = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const [notes, setNotes] = useInput(effSolve.notes);

	const scramble = solve.scramble;
	const cubeType = solve.cube_type;
	const visualCubeType = (cubeType === 'wca' && solve.scramble_subset) ? solve.scramble_subset : cubeType;

	function handleShare() {
		const solveUrl = window.location.origin + '/solve/' + solve.share_code;
		shareContent({
			title: `${cubeTypeInfo.name} - ${time} | Zkt Timer`,
			text: `⚡ ${time} on ${cubeTypeInfo.name} — solved on Zkt Timer`,
			url: solveUrl,
		});
	}

	let shareLink = null;
	if (typeof window !== 'undefined' && canSync()) {
		shareLink = (
			<>
				<CopyText
					buttonProps={{ text: t('solve_info.share_link') }}
					text={window.location.origin + '/solve/' + solve.share_code}
				/>
				<Button
					gray
					icon={<ShareNetwork weight="bold" />}
					onClick={handleShare}
				/>
			</>
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

	const openTextModal = () => {
		dispatch(
			openModal(
				<HistoryModal
					solves={[solve]}
					showAsText={true}
					description={t('solve_info.single_solve')}
					time={solve.time}
				/>
			)
		);
	};

	return (
		<div className={b({ mobile: mobileMode, normal: true })}>
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
			<div className={b('body')}>
				<h2>{time}</h2>
				<div className={b('sub')}>
					<Avatar small user={user} hideBadges profile={user?.profile} />
					<div className={b('sub-actions')}>
						<Tag icon={<Cube weight="bold" />} backgroundColor="button" text={cubeTypeInfo.name} />
						{plusTwoButton}
						{dnfButton}
					</div>
					<div className={b('date-info')}>
						<span>{getFullFormattedDate(endedAt)}</span>
					</div>
				</div>

				<div className={b('inline-scramble')}>
					<legend>{t('solve_info.scramble_label')}</legend>
					<div className={b('inline-scramble-visual')}>
						<ScrambleVisual cubeType={visualCubeType} scramble={scramble} />
					</div>
					{editMode ? (
						<TextArea fullWidth autoSize value={scramble} name="scramble" onChange={handleChange} />
					) : (
						<p>{scramble}</p>
					)}
					<div className={b('inline-scramble-actions')}>
						<Button text={t('solve_info.view_as_stats')} onClick={openTextModal} />
					</div>
				</div>

				<div className={b('inline-notes')}>
					<legend>{t('solve_info.notes_label')}</legend>
					{editMode ? (
						<TextArea
							value={notes || ''}
							autoSize
							name="notes"
							onChange={(e) => {
								setNotes(e);
								handleChange(e);
							}}
						/>
					) : (
						notes ? <p>{notes}</p> : <i>{t('solve_info.no_notes')}</i>
					)}
				</div>
			</div>
		</div>
	);
}
