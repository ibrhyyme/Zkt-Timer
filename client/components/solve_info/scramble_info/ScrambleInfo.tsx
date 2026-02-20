import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import './ScrambleInfo.scss';
import ScrambleVisual from '../../modules/scramble/ScrambleVisual';
import TextArea from '../../common/inputs/textarea/TextArea';
import Button from '../../common/button/Button';
import HistoryModal from '../../modules/history/history_modal/HistoryModal';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';

const b = block('solve-info-scramble');

interface Props {
	solve: Solve;
	editMode?: boolean;
	handleChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}

export default function ScrambleInfo(props: Props) {
	const { t } = useTranslation();
	const { solve, editMode, handleChange } = props;
	const scramble = solve.scramble;
	const cubeType = solve.cube_type;
	const dispatch = useDispatch();

	const scrambleBody = (
		<div className={b('body')}>
			<ScrambleVisual cubeType={cubeType} scramble={scramble} />
		</div>
	);

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
		<div className={b()}>
			{scrambleBody}
			{editMode ? (
				<TextArea fullWidth autoSize value={scramble} name="scramble" onChange={handleChange} />
			) : (
				<p>{scramble}</p>
			)}
			<div className="w-full flex justify-center mt-4">
				<Button
					text={t('solve_info.view_as_stats')}
					onClick={openTextModal}
				/>
			</div>
		</div>
	);
}
