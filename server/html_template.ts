import { HelmetData } from 'react-helmet';

export interface HtmlPagePayload {
	html: string;
	cleanState: string;
	helmet: HelmetData;
	distBase: string;
	resourceBase: string;
	cssFileName: string;
	jsFileName: string;
	lang: string;
}

export default (payload: HtmlPagePayload) => {
	const { html, cleanState, helmet, distBase, resourceBase, cssFileName, jsFileName, lang } = payload;

	// Cache-busting: Browsers download new files at each deployment
	const version = process.env.RELEASE_NAME || Date.now().toString();

	return `
		<!DOCTYPE html>
		<html lang="${lang}">
			<head>
				<meta charset="UTF-8" />
				<meta http-equiv="X-UA-Compatible" content="ie=edge" />
				<script>try{var _t=JSON.parse(localStorage.getItem('zkt_theme')),_p=location.pathname.split('/')[1];if(_t&&['login','signup','wca-signup','zkt-signup','welcome','links'].indexOf(_p)<0){var _h=document.documentElement,_s=_h.style;if(_t.bg)_s.setProperty('--background-color',_t.bg);if(_t.mod)_s.setProperty('--module-color',_t.mod);if(_t.btn)_s.setProperty('--button-color',_t.btn);if(_t.txt)_s.setProperty('--text-color',_t.txt);if(_t.pri)_s.setProperty('--primary-color',_t.pri);if(_t.sec)_s.setProperty('--secondary-color',_t.sec);_h.classList.add(_t.light?'theme-light':'theme-dark');}}catch(e){}</script>
				<link rel="stylesheet" href="${distBase}/${cssFileName}?v=${version}">
				<link rel="stylesheet" href="/public/cubing-icons/cubing-icons.css">
				<link rel="icon" type="image/png" href="${resourceBase}/images/zkt-logo.png?v=${version}">
				<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
				<!-- PWA Manifest -->
				<link rel="manifest" href="/public/manifest.webmanifest">
				<meta name="theme-color" content="#0F142B">

				<!-- iOS / PWA -->
				<meta name="mobile-web-app-capable" content="yes">
				<meta name="apple-mobile-web-app-capable" content="yes">
				<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
				<meta name="apple-mobile-web-app-title" content="Zkt Timer">
				<meta name="application-name" content="Zkt Timer">
				<meta name="format-detection" content="telephone=no">
				<!-- Smart App Banner: shows "Open in App" button in Safari -->
				<meta name="apple-itunes-app" content="app-id=6760920873">
				<!-- Android: native app prompt in Chrome -->
				<meta name="google-play-app" content="app-id=com.zktimer.app">
				<link rel="alternate" href="android-app://com.zktimer.app/https/zktimer.app/">
				<!-- iOS Home Screen Icon (Must be PNG, SVG not supported) -->
				<link rel="apple-touch-icon" href="${resourceBase}/images/apple-touch-icon.png?v=${version}">
				<link rel="apple-touch-icon" sizes="152x152" href="${resourceBase}/images/apple-touch-icon.png?v=${version}">
				<link rel="apple-touch-icon" sizes="180x180" href="${resourceBase}/images/apple-touch-icon.png?v=${version}">
				<link rel="apple-touch-icon" sizes="167x167" href="${resourceBase}/images/apple-touch-icon.png?v=${version}">
				<!-- iOS Launch Screen (Splash screen-like effect) -->
				<link rel="apple-touch-startup-image" href="${resourceBase}/images/apple-touch-icon.png?v=${version}">
				<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
				${helmet.title.toString()}
				${helmet.meta.toString()}
				${helmet.link.toString()}
				${helmet.script.toString()}
			</head>

			<body>
				<div id="app">${html}</div>
			</body>
			<script type="text/javascript">
				window.__STORE__ = ${cleanState};
				window.__REVENUECAT_IOS_KEY__ = ${JSON.stringify(process.env.REVENUECAT_IOS_KEY || '')};
				window.__REVENUECAT_ANDROID_KEY__ = ${JSON.stringify(process.env.REVENUECAT_ANDROID_KEY || '')};
				window.__ASSET_VERSION__ = ${JSON.stringify(version)};
			</script>
			<script src="${distBase}/${jsFileName}?v=${version}"></script>
		</html>
	`;
};
