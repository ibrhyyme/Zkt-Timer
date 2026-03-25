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
