import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {openModal, closeModal} from '../../../actions/general';
import {b} from './shared';
import {useTranslation} from 'react-i18next';

interface Props {
	trigger: React.ReactNode; // content of the button that opens the modal
	triggerClassName?: string;
	triggerIsSet?: boolean; // adds "set" modifier to trigger button
	title: string;
	children: (ctx: {close: () => void}) => React.ReactNode; // render prop with close callback
	onOk: () => Promise<void> | void;
	onReset?: () => void;
	okLabel?: string;
	cancelLabel?: string;
	disabled?: boolean;
}

/**
 * WCA-style: button click opens a modal with inline editing.
 * `children` is a render prop with a `close` callback.
 */
export default function ButtonActivatedModal(props: Props) {
	const {
		trigger,
		triggerClassName,
		triggerIsSet,
		title,
		children,
		onOk,
		onReset,
		okLabel,
		cancelLabel,
		disabled,
	} = props;
	const dispatch = useDispatch();

	function openEditor() {
		if (disabled) return;
		dispatch(
			openModal(<ModalBody title={title} onOk={onOk} onReset={onReset} okLabel={okLabel} cancelLabel={cancelLabel}>{children}</ModalBody>)
		);
	}

	return (
		<button
			type="button"
			className={triggerClassName || b('round-field-btn', {set: triggerIsSet})}
			onClick={openEditor}
			disabled={disabled}
		>
			{trigger}
		</button>
	);
}

function ModalBody({
	title,
	onOk,
	onReset,
	okLabel,
	cancelLabel,
	children,
}: {
	title: string;
	onOk: () => Promise<void> | void;
	onReset?: () => void;
	okLabel?: string;
	cancelLabel?: string;
	children: (ctx: {close: () => void}) => React.ReactNode;
}) {
	const dispatch = useDispatch();
	const {t} = useTranslation();
	const [submitting, setSubmitting] = useState(false);
	const close = () => dispatch(closeModal());

	async function handleOk() {
		setSubmitting(true);
		try {
			await onOk();
			close();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className={b('modal-content')}>
			<h2 className={b('modal-title')}>{title}</h2>
			<div>{children({close})}</div>
			<div className={b('modal-actions')}>
				{onReset && (
					<button type="button" className={b('modal-btn', {danger: true})} onClick={onReset}>
						{t('common.reset')}
					</button>
				)}
				<button type="button" className={b('modal-btn')} onClick={close}>
					{cancelLabel || t('common.cancel')}
				</button>
				<button
					type="button"
					className={b('modal-btn', {primary: true})}
					onClick={handleOk}
					disabled={submitting}
				>
					{submitting ? '...' : okLabel || t('common.save')}
				</button>
			</div>
		</div>
	);
}
