import React from 'react';
import { useTranslation } from 'react-i18next';
import TextArea from '../../common/inputs/textarea/TextArea';
import block from '../../../styles/bem';
import CopyIconButton from './CopyIconButton';
import './SolveCard.scss';

const b = block('solve-card');

interface Props {
	scramble: string;
	/** Edit mode with a handler turns the text into a field (the normal card). */
	editMode?: boolean;
	onChange?: (e: any) => void;
	/** More actions after the copy button. */
	children?: React.ReactNode;
}

/** A solve's scramble as one plain row between hairlines, with its copy button. */
export default function SolveScramble({ scramble, editMode, onChange, children }: Props) {
	const { t } = useTranslation();

	return (
		<section className={b('section')}>
			<div className={b('label')}>{t('solve_info.scramble_label')}</div>
			<div className={b('scramble')}>
				{editMode && onChange ? (
					<TextArea fullWidth autoSize value={scramble} name="scramble" onChange={onChange} />
				) : (
					<div className={b('scramble-text')}>{scramble}</div>
				)}
				<div className={b('scramble-actions')}>
					<CopyIconButton text={scramble || ''} label={t('solve_info.copy')} />
					{children}
				</div>
			</div>
		</section>
	);
}
