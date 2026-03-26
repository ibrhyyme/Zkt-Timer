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
				<meta http-equiv="X-UA-Compatible" content="ie=edge" />
				<link rel="preconnect" href="https://fonts.gstatic.com">
				<link rel="preload" href="https://fonts.googleapis.com/css2?family=Fira+Mono&family=Fira+Sans&family=JetBrains+Mono&family=Kiwi+Maru&family=Montserrat&family=Poppins&family=Roboto+Mono&family=Space+Mono&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
				<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Mono&family=Fira+Sans&family=JetBrains+Mono&family=Kiwi+Maru&family=Montserrat&family=Poppins&family=Roboto+Mono&family=Space+Mono&display=swap"></noscript>
				<link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,900&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
				<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,900&display=swap"></noscript>
				<link rel="stylesheet" href="${distBase}/${cssFileName}?v=${version}">
				<link rel="stylesheet" href="https://cdn.cubing.net/v0/css/@cubing/icons/css">
				<link rel="shortcut icon" href="${resourceBase}/favicon.ico" type="image/x-icon">
				<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
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
				${process.env.NODE_ENV === "production" ? `<script async defer data-domain="zktimer.app" src="https://plausible.io/js/plausible.js"></script>` : ""}
				<script async defer src="https://www.googletagmanager.com/gtag/js?id=AW-354788011"></script>
				<script>
				  window.dataLayer = window.dataLayer || [];
				  function gtag(){dataLayer.push(arguments);}
				  gtag('js', new Date());

				  gtag('config', 'AW-354788011');
				</script>

				${helmet.title.toString()}
				${helmet.meta.toString()}
				${helmet.link.toString()}
				${helmet.script.toString()}
			</head>

			<body style="background-color:#12141C;color:#fff;margin:0;">
				<div id="app-preloader" style="position:fixed;inset:0;z-index:99999999;display:flex;justify-content:center;align-items:center;background-color:#12141C;">
					<img src="${resourceBase}/images/zkt-logo.png" alt="" style="width:8rem;animation:zkt-spin 1.2s linear infinite;">
				</div>
				<style>@keyframes zkt-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
				<div id="app">${html}</div>
				<script>
					(function(){
						var obs=new MutationObserver(function(){
							var el=document.getElementById('app-preloader');
							if(el&&document.querySelector('.cd-loading-cover--fadeOut')){
								el.style.transition='opacity 0.3s';
								el.style.opacity='0';
								setTimeout(function(){el.remove();obs.disconnect();},350);
							}
						});
						obs.observe(document.getElementById('app'),{attributes:true,subtree:true,childList:true});
						setTimeout(function(){var el=document.getElementById('app-preloader');if(el)el.remove();},30000);
					})();
				</script>
			</body>
			<script type="text/javascript">
				window.__STORE__ = ${cleanState};
			</script>
			<script src="${distBase}/${jsFileName}?v=${version}"></script>
		</html>
	`;
};
