import React from 'react';
import { useTranslation } from 'react-i18next';
import './AbortSolveOverlay.scss';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';

const b = block('abort-solve-overlay');

interface Props {
	showAbortButton: boolean;
	showDialog: boolean;
	showMismatchBanner: boolean;
	onAbortClick: () => void;
	onDnf: () => void;
	onDiscard: () => void;
	onContinue: () => void;
	onResetCubeState: () => void;
}

export default function AbortSolveOverlay(props: Props) {
	const { t } = useTranslation();
	const {
		showAbortButton,
		showDialog,
		showMismatchBanner,
		onAbortClick,
		onDnf,
		onDiscard,
		onContinue,
		onResetCubeState,
	} = props;

	if (!showAbortButton && !showDialog && !showMismatchBanner) {
		return null;
	}

	return (
		<>
			{showAbortButton && !showDialog && (
				<div className={b('button-container')}>
					<Button
						danger
						text={t('smart_cube.abort_solve')}
						onClick={onAbortClick}
					/>
				</div>
			)}

			{showDialog && (
				<div className={b('dialog-overlay')}>
					<div className={b('dialog')}>
						<h3 className={b('dialog-title')}>
							{t('smart_cube.abort_confirm_heading')}
						</h3>
						<p className={b('dialog-description')}>
							{t('smart_cube.abort_confirm_title')}
						</p>
						<div className={b('dialog-buttons')}>
							<Button
								danger
								fullWidth
								text={t('smart_cube.abort_save_dnf')}
								onClick={onDnf}
							/>
							<Button
								danger
								fullWidth
								text={t('smart_cube.abort_discard')}
								onClick={onDiscard}
							/>
							<Button
								success
								fullWidth
								text={t('smart_cube.abort_continue')}
								onClick={onContinue}
							/>
						</div>
					</div>
				</div>
			)}

			{showMismatchBanner && (
				<div className={b('mismatch-banner')}>
					<span className={b('mismatch-text')}>
						{t('smart_cube.cube_mismatch_message')}
					</span>
					<Button
						danger
						small
						text={t('smart_cube.reset_cube_state')}
						onClick={onResetCubeState}
					/>
				</div>
			)}
		</>
	);
}
