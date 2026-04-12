import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import './ConfirmModal.scss';
import Button, {ButtonProps} from '../button/Button';
import {IModalProps} from '../modal/Modal';
import Input from '../inputs/input/Input';
import {useWindowListener} from '../../../util/hooks/useListener';
import ProOnly from '../pro_only/ProOnly';
import block from '../../../styles/bem';

const b = block('confirm-modal');

interface ConfirmModalInfoBox {
	value: string | number;
	label: string;
}

export interface ConfirmModalProps extends IModalProps {
	buttonProps?: ButtonProps;
	buttonText: string;
	hideInput?: boolean;
	proOnly?: boolean;
	triggerAction: () => Promise<any>;
	infoBoxes?: ConfirmModalInfoBox[];
}

export default function ConfirmModal(props: ConfirmModalProps) {
	const {t} = useTranslation();
	const {buttonProps, infoBoxes, proOnly, triggerAction, buttonText, hideInput, onComplete} = props;

	const [confirm, setConfirm] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	useWindowListener('keypress', onSubmit);

	function handleChange(e) {
		setConfirm(e.target.value);
		setError('');
	}

	async function onSubmit(e) {
		if (e.keyCode === 13 && hideInput) {
			await onClick(e);
		}
	}

	async function onClick(e) {
		e.preventDefault();

		if (loading) {
			return;
		}

		setLoading(true);

		if (confirm.toLowerCase() !== t('confirm_modal.confirm_word') && !hideInput) {
			setError(t('confirm_modal.confirm_prompt'));
			return;
		}

		let res;
		try {
			res = await triggerAction();
		} catch (e) {
			setError(e.message);
			setLoading(false);
			return;
		}

		if (onComplete) {
			onComplete(res);
		}
	}

	let input = (
		<Input
			placeholder={t('confirm_modal.confirm_word')}
			info={t('confirm_modal.confirm_prompt')}
			onChange={handleChange}
			name="confirm"
			value={confirm}
		/>
	);

	let disabled = confirm.toLowerCase() !== t('confirm_modal.confirm_word');
	if (hideInput) {
		input = null;
		disabled = false;
	}

	let infoBoxContainer = null;
	if (infoBoxes && infoBoxes.length) {
		infoBoxContainer = (
			<div className={b('info-boxes')}>
				{infoBoxes.map((box, i) => (
					<div key={i} className={b('info-box')}>
						<span className={b('info-box-value')}>{box.value}</span>
						<span className={b('info-box-label')}>{box.label}</span>
					</div>
				))}
			</div>
		);
	}

	return (
		<form className={b()} onSubmit={onClick}>
			{infoBoxContainer}
			<ProOnly ignore={!proOnly}>
				<div>
					<div className={b('input')}>{input}</div>
					<div className={b('actions')}>
						<Button
							glow
							large
							type={hideInput ? 'submit' : 'button'}
							text={buttonText}
							danger
							loading={loading}
							onClick={onClick}
							disabled={disabled}
							error={error}
							{...buttonProps}
						/>
					</div>
				</div>
			</ProOnly>
		</form>
	);
}
