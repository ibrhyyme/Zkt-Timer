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

	// Cache-busting: Her deployment'ta tarayıcılar yeni dosyaları indirsin
	const version = process.env.RELEASE_NAME || Date.now().toString();

	return `
		<!DOCTYPE html>
		<html lang="${lang}">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta http-equiv="X-UA-Compatible" content="ie=edge" />
				<link rel="preconnect" href="https://fonts.gstatic.com">
				<link rel="preload" href="https://fonts.googleapis.com/css2?family=Fira+Mono&family=Fira+Sans&family=JetBrains+Mono&family=Kiwi+Maru&family=Montserrat&family=Poppins&family=Roboto+Mono&family=Space+Mono&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
				<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Mono&family=Fira+Sans&family=JetBrains+Mono&family=Kiwi+Maru&family=Montserrat&family=Poppins&family=Roboto+Mono&family=Space+Mono&display=swap"></noscript>
				<link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,900&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
				<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,900&display=swap"></noscript>
				<link rel="stylesheet" href="${distBase}/${cssFileName}?v=${version}">
				<link rel="stylesheet" href="https://cdn.cubing.net/v0/css/@cubing/icons/css">
				<link rel="shortcut icon" href="${resourceBase}/favicon.ico" type="image/x-icon">  
				<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
				
				<!-- PWA Manifest -->
				<link rel="manifest" href="/public/manifest.webmanifest">
				<!-- iOS PWA Uyumluluğu (Otomatik Splash Screen Oluşturucu) -->
				<script async src="https://cdn.jsdelivr.net/npm/pwacompat" crossorigin="anonymous"></script>
				<meta name="theme-color" content="#0F142B">
				
				<!-- iOS -->
				<meta name="mobile-web-app-capable" content="yes">
				<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
				<meta name="apple-mobile-web-app-title" content="Zkt-Timer">
				<!-- iOS Ana Ekran İkonu (Mutlaka PNG olmalı, SVG desteklenmez) -->
				<link rel="apple-touch-icon" href="${resourceBase}/images/apple-touch-icon.png">
				<link rel="apple-touch-icon" sizes="152x152" href="${resourceBase}/images/apple-touch-icon.png">
				<link rel="apple-touch-icon" sizes="180x180" href="${resourceBase}/images/apple-touch-icon.png">
				<link rel="apple-touch-icon" sizes="167x167" href="${resourceBase}/images/apple-touch-icon.png">
				<!-- iOS Açılış Ekranı (Splash Screen benzeri etki için) -->
				<link rel="apple-touch-startup-image" href="${resourceBase}/images/apple-touch-icon.png">
				${process.env.NODE_ENV === "production" ? `<script async defer data-domain="zkt-timer.io" src="https://plausible.io/js/plausible.js"></script>` : ""}
				<script async defer src="https://www.googletagmanager.com/gtag/js?id=AW-354788011"></script>
				<script>
				  window.dataLayer = window.dataLayer || [];
				  function gtag(){dataLayer.push(arguments);}
				  gtag('js', new Date());
				
				  gtag('config', 'AW-354788011');
				</script>
	
				<title>Zkt-Timer</title>
				
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
			</script>
			<script src="${distBase}/${jsFileName}?v=${version}"></script>
		</html>
	`;
};
