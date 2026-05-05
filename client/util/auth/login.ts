const LOGIN_PATH = '/login';
const SIGN_UP_PATH = '/signup';
const REDIRECT_PARAM_NAME = 'redirect';

function getRawURI() {
	if (typeof window === 'undefined') {
		return '';
	}

	return window.location.href;
}

function getLinkHelper(path: string) {
	if (typeof window === 'undefined') {
		return '';
	}

	const urlParams = new URLSearchParams(window.location.search);
	let redirect = urlParams.get(REDIRECT_PARAM_NAME);

	const uri = getRawURI();

	if (!redirect) {
		redirect = encodeURIComponent(uri);
	} else if (redirect.indexOf('/') > -1) {
		redirect = encodeURIComponent(redirect);
	}

	return `${path}?${REDIRECT_PARAM_NAME}=${redirect}`;
}

export function getLoginLink() {
	return getLinkHelper(LOGIN_PATH);
}

export function getSignUpLink() {
	return getLinkHelper(SIGN_UP_PATH);
}

// Falls back to timer path if nothing can be found.
// Open redirect korumasi: sadece same-origin path'lere izin verilir.
// "//evil.com" (protocol-relative) ve "https://evil.com" gibi cross-origin redirect'leri engeller.
export function getRedirectLink() {
	if (typeof window === 'undefined') {
		return '/timer';
	}

	const urlParams = new URLSearchParams(window.location.search);
	const redirect = urlParams.get(REDIRECT_PARAM_NAME);

	if (!redirect) {
		return '/timer';
	}

	try {
		// URL constructor protocol-relative ve absolute URL'leri parse eder
		const decoded = decodeURIComponent(redirect);
		const url = new URL(decoded, window.location.origin);
		if (url.origin !== window.location.origin) {
			return '/timer';
		}
		return url.pathname + url.search + url.hash;
	} catch {
		return '/timer';
	}
}
