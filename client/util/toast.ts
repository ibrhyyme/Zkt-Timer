import { toast, ToastOptions } from 'react-toastify';
import { showNativeToast } from './native-plugins';
import { isNative } from './platform';

const toastOptions: ToastOptions = {
	position: 'bottom-left',
	autoClose: 5000,
	icon: false,
	hideProgressBar: true,
	closeOnClick: true,
	pauseOnHover: true,
	draggable: true,
	progress: undefined,
};

export function toastAlertGqlResult(result, successMessage) {
	if (!result.errors) {
		toastSuccess(successMessage);
	} else {
		toastErrorGqlResult(result);
	}
}

export function toastErrorGqlResult(result) {
	for (const error of result?.errors || []) {
		toastError(error.message);
	}
}

export function toastDismiss() {
	toast.dismiss();
}

export function toastSuccess(message: string) {
	if (isNative()) {
		showNativeToast(message);
		return;
	}
	toast.success(message, toastOptions);
}

export function toastWarning(message: string) {
	if (isNative()) {
		showNativeToast(message);
		return;
	}
	toast.warning(message, toastOptions);
}

export function toastInfo(message: string) {
	if (isNative()) {
		showNativeToast(message);
		return;
	}
	toast.info(message, toastOptions);
}

/**
 * A toast that stays up and is later turned into its result by `toastSettle` under the
 * same id. A second call while it is showing rewrites it instead of stacking another one.
 * Web only: native toasts cannot be updated, so there only the result is shown.
 */
export function toastProgress(id: string, message: string) {
	if (isNative()) {
		return;
	}
	if (toast.isActive(id)) {
		toast.update(id, {render: message, type: 'info', autoClose: false});
		return;
	}
	toast.info(message, {...toastOptions, toastId: id, autoClose: false});
}

export function toastSettle(id: string, type: 'success' | 'warning' | 'error', message: string) {
	if (isNative()) {
		showNativeToast(message, type === 'success' ? 'short' : 'long');
		return;
	}
	if (toast.isActive(id)) {
		toast.update(id, {render: message, type, autoClose: toastOptions.autoClose});
		return;
	}
	// The progress toast may still be queued rather than mounted, in which case a new toast
	// under the same id would be discarded as a duplicate and the sticky one left behind.
	// Close it and show the result under an id of its own.
	toast.dismiss(id);
	const resultId = `${id}:result`;
	if (toast.isActive(resultId)) {
		toast.update(resultId, {render: message, type, autoClose: toastOptions.autoClose});
		return;
	}
	toast[type](message, {...toastOptions, toastId: resultId});
}

export function toastDismissId(id: string) {
	if (isNative()) {
		return;
	}
	toast.dismiss(id);
}

export function toastError(message: string | Error) {
	let msg = message;
	if (message instanceof Error) {
		msg = message.message
	}

	if (isNative()) {
		showNativeToast(msg as string, 'long');
		return;
	}
	toast.error(msg as string, toastOptions);
}
