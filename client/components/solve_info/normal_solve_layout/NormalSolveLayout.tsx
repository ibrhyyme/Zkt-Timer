import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import HistoryModal from '../../modules/history/history_modal/HistoryModal';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import { SolveLayoutProps } from '../SolveInfo';
import { canReadSync } from '../../../lib/sync-gate';
import PhaseBreakdown from '../phase_breakdown/PhaseBreakdown';
import SolveCardHeader from '../solve_card/SolveCardHeader';
import SolveScramble from '../solve_card/SolveScramble';

const b = block('solve-info');

export default function NormalSolveLayout(props: SolveLayoutProps) {
	const { solve, effSolve, editMode, mobileMode, handleChange } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();

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
			<SolveCardHeader layout={props} canShareLink={canReadSync()} />

			<SolveScramble scramble={solve.scramble} editMode={editMode} onChange={handleChange}>
				<Button small gray text={t('solve_info.view_as_stats')} onClick={openTextModal} />
			</SolveScramble>

			<PhaseBreakdown
				phaseSplits={effSolve.phase_splits}
				rawTime={effSolve.raw_time}
			/>
		</div>
	);
}
