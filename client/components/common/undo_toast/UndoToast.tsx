import React from 'react';
import {toast} from 'react-toastify';
import {useTranslation} from 'react-i18next';
import './UndoToast.scss';
import block from '../../../styles/bem';

const b = block('undo-toast');

/**
 * A toast with one action, for changes that are reversible for a few seconds.
 *
 * It goes through react-toastify directly rather than through util/toast.ts, which hands
 * native builds to the OS toast: that one cannot carry a button, and an undo the user
 * cannot press is not an undo. The toast renders inside the app on every platform.
 */

interface ContentProps {
	message: string;
	actionLabel: string;
	onAction: () => void;
	close: () => void;
}

function UndoToastContent({message, actionLabel, onAction, close}: ContentProps) {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<span className={b('message')}>{t(message)}</span>
			{/* A real button: the timer ignores touches that land on one, so pressing undo
			    on a phone can never prime a solve behind the toast. */}
			<button
				type="button"
				className={b('action')}
				onClick={() => {
					onAction();
					close();
				}}
			>
				{t(actionLabel)}
			</button>
		</div>
	);
}

export interface UndoToastOptions {
	/** Translation key of the message. */
	message: string;
	/** Translation key of the action label. */
	actionLabel: string;
	onAction: () => void;
	durationMs: number;
}

/** Shows the toast and returns a function that closes it again. */
export function showUndoToast(options: UndoToastOptions): () => void {
	if (typeof window === 'undefined') {
		return () => undefined;
	}

	const id = toast(
		<UndoToastContent
			message={options.message}
			actionLabel={options.actionLabel}
			onAction={options.onAction}
			close={() => toast.dismiss(id)}
		/>,
		{
			position: 'bottom-left',
			autoClose: options.durationMs,
			hideProgressBar: true,
			// A stray tap must not throw the undo away before the user has read it.
			closeOnClick: false,
			pauseOnHover: false,
			draggable: false,
			closeButton: false,
			icon: false,
		}
	);

	return () => toast.dismiss(id);
}
