import React, { ReactNode } from 'react';
import thunk from 'redux-thunk';
import ReactDOM from 'react-dom/server';
import promise from 'redux-promise-middleware';
import { applyMiddleware, createStore, Store } from 'redux';
import type { Request } from 'express';
import { Provider } from 'react-redux';
import { StaticRouter, Switch } from 'react-router-dom';
import { minify } from 'html-minifier';
import { PageContext, routes, SsrMeta } from '../client/components/layout/Routes';
import htmlTemplate, { HtmlPagePayload } from './html_template';
import reducers from '../client/reducers/reducers';
import { initUserAccount } from './models/store';

import { Helmet } from 'react-helmet';
import { mapSingleRoute } from '../client/components/map_route';
import { ApolloClient, ApolloProvider, InMemoryCache, ApolloLink } from '@apollo/client';
import { I18nextProvider } from 'react-i18next';
import { createI18nInstance } from './i18n_server';
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
import { logger } from './services/logger';
import { ErrorCode } from './constants/errors';

if (process.env.NODE_ENV !== "production") {
	loadDevMessages();
	loadErrorMessages();
}

const mappedRoutes: ReactNode[] = [];

function safeStringify(object) {
	return JSON.stringify(object)
		.replace(/<\/(script)/gi, '<\\/$1')
		.replace(/<!--/g, '<\\!--')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

function renderFullPage(html, helmet, preloadedState, lang: string = 'en') {
	let cleanState = JSON.stringify(preloadedState).replace(/</g, '\\u003c');
	cleanState = safeStringify(cleanState);

	const deploymentId = process.env.DEPLOYMENT_ID || 'app';

	const payload: HtmlPagePayload = {
		html,
		helmet,
		cleanState,
		distBase: process.env.DIST_BASE_URI || '/dist',
		resourceBase: process.env.RESOURCES_BASE_URI || '/public',
		jsFileName: `${deploymentId}.min.js`,
		cssFileName: `${deploymentId}.min.css`,
		lang,
	};

	return htmlTemplate(payload);
}

const SITE_URL = 'https://zktimer.app';

/**
 * Emits a route's own <head> tags during SSR.
 *
 * Rendered AFTER the router so react-helmet's last-one-wins resolution lets it
 * override the site-wide defaults that App's own <Header> produces. Needed because
 * App hides its route children behind `appLoaded`, which never becomes true on the
 * server, so the page component's Helmet never runs. Crawlers don't execute JS, so
 * this is the only copy of these tags they will ever see.
 */
function SsrMetaTags({meta, path}: {meta: SsrMeta; path: string}) {
	const url = `${SITE_URL}${path}`;
	const image = meta.image
		? (meta.image.startsWith('http') ? meta.image : `${SITE_URL}${meta.image}`)
		: null;

	return (
		<Helmet>
			{meta.title ? <title>{meta.title}</title> : null}
			{meta.title ? <meta property="og:title" content={meta.title} /> : null}
			{meta.title ? <meta name="twitter:title" content={meta.title} /> : null}
			{meta.description ? <meta name="description" content={meta.description} /> : null}
			{meta.description ? <meta property="og:description" content={meta.description} /> : null}
			{meta.description ? <meta name="twitter:description" content={meta.description} /> : null}
			{image ? <meta property="og:image" content={image} /> : null}
			{image ? <meta property="og:image:secure_url" content={image} /> : null}
			{image ? <meta name="twitter:image" content={image} /> : null}
			<meta property="og:url" content={url} />
		</Helmet>
	);
}

function createComponents(req, store, route?: PageContext) {
	// Detect language from cookie for SSR
	const lng = req.cookies?.zkt_language || 'en';
	const i18nInstance = createI18nInstance(lng);

	const client = new ApolloClient({
		ssrMode: true,
		cache: new InMemoryCache(),
		link: ApolloLink.empty(),
	});

	const staticRouter = (
		<StaticRouter location={req.url} context={{}}>
			<I18nextProvider i18n={i18nInstance}>
				<ApolloProvider client={client}>
					<Provider store={store}>
						<Switch>
							{routes.map((route: { [key: string]: any }) => {
								route.exact = true;
								return mapSingleRoute(route);
							})}
						</Switch>
					</Provider>
				</ApolloProvider>
			</I18nextProvider>
		</StaticRouter>
	);

	let ssrMeta: SsrMeta | null = null;
	if (route?.ssrMeta) {
		try {
			ssrMeta = route.ssrMeta(store, req, i18nInstance.t.bind(i18nInstance));
		} catch (e) {
			// A broken meta builder must never take the page down with it.
			logger.warn('SSR meta builder failed', {path: route.path, error: e?.message || e});
		}
	}

	const tree = ssrMeta ? (
		<>
			{staticRouter}
			<SsrMetaTags meta={ssrMeta} path={req.url.split('?')[0]} />
		</>
	) : (
		staticRouter
	);

	const markup = ReactDOM.renderToString(tree);
	const helmet = Helmet.renderStatic();
	const preloaded = store.getState();

	// Get html and minify it.
	// minifyCSS stays OFF on purpose: it rewrites inline `style` attributes too
	// (`rect(0, 0, 0, 0)` -> `rect(0,0,0,0)`), which no longer matches what React
	// renders on the client. Every SSR'd component with an inline style then fails
	// hydration with a "Prop `style` did not match" warning and gets re-rendered.
	const fullHtml = renderFullPage(markup, helmet, preloaded, lng);
	return minify(fullHtml, { collapseWhitespace: true, minifyJS: true, minifyCSS: false });
}

function appUseRouteForPage(routePath, route: PageContext) {
	global.app.all(routePath, async (req, res) => {
		// If no language cookie on first visit, detect from Accept-Language
		if (!req.cookies?.zkt_language) {
			const acceptLang = req.headers['accept-language'] || '';
			const preferred = ['zh', 'en', 'es', 'ru', 'tr'].find(
				(l) => acceptLang.toLowerCase().includes(l)
			) || 'en';
			res.cookie('zkt_language', preferred, { maxAge: 365 * 24 * 60 * 60 * 1000, path: '/' });
		}

		const store = createStore(reducers, {}, applyMiddleware(promise(), thunk));
		const promises: ((store: Store<any>, req: Request) => Promise<any>)[] = route.prefetchData || [];
		const me = await initUserAccount(store, req);

		// Redirect root route to timer if authenticated, to welcome if not
		if (routePath === '/' && me) {
			res.status(302).redirect('/timer');
			return;
		}
		if (routePath === '/' && !me) {
			res.status(302).redirect('/welcome');
			return;
		}

		// Redirect logged-in users from welcome page to timer
		if (routePath === '/welcome' && me) {
			res.status(302).redirect('/timer');
			return;
		}

		// Redirect to /login if page is restricted and user is not logged in
		if (route.restricted && !me) {
			res.status(401).redirect('/login?redirect=' + encodeURIComponent(req.url));
			return;
		}

		// Only admin/mod can access admin pages; others see 404.
		// Mod (but not admin) can only access ZKT competition pages.
		if (route.admin) {
			if (!me || (!me.admin && !me.mod)) {
				res.status(404).sendFile(`${__dirname}/resources/not_found.html`);
				return;
			}
			if (me.mod && !me.admin) {
				// Mods may only access the standalone competition management pages.
				const isCompetitionsRoute = routePath.startsWith('/organizer');
				if (!isCompetitionsRoute) {
					res.status(404).sendFile(`${__dirname}/resources/not_found.html`);
					return;
				}
			}
		}

		// Redirect to home page if user is logged in and on login page
		if (me && (routePath === '/login' || routePath === '/signup' || routePath === '/wca-signup')) {
			res.status(302).redirect('/timer');
			return;
		}

		let code = 200;
		try {
			await Promise.all(promises.map((f) => f(store, req)));
		} catch (e) {
			const errors = e?.graphQLErrors || [];
			let isNotFound = false;

			for (const graphErr of errors) {
				const errCode = graphErr?.extensions?.code;
				if (errCode === ErrorCode.NOT_FOUND) {
					isNotFound = true;
					break;
				}
			}

			if (isNotFound) {
				res.status(404).sendFile(`${__dirname}/resources/not_found.html`);
				return;
			}

			// For non-GraphQL errors, log and render page without prefetched data
			logger.warn('SSR prefetch failed, rendering without prefetched data', {
				path: routePath,
				error: e?.message || e,
			});
		}

		// Initiates the whole store
		const html = createComponents(req, store, route);

		if (!code) {
			code = 500;
			logger.warn('Invalid status code when trying to generate page', {
				path: routePath,
			});
		}

		if (!res.headersSent) {
			const isAuthenticated = !!req.cookies?.session;
			res.setHeader(
				'Cache-Control',
				isAuthenticated
					? 'private, no-store'
					: 'public, s-maxage=300, max-age=60, stale-while-revalidate=30'
			);
			res.status(code).send(html);
		}
	});
}

export function mapPathToPage() {
	for (const route of routes) {
		mappedRoutes.push(mapSingleRoute(route));

		const routePath = route.path.replace(/\s/g, '');
		if ('redirect' in route && route.redirect) {
			redirectPage(routePath, route);
			continue;
		}

		appUseRouteForPage(routePath, route as PageContext);
	}
}

function redirectPage(routePath, route) {
	global.app.get(routePath, (req, res) => {
		let redirect = route.redirect;
		const keys = Object.keys(req.params);
		for (const key of keys) {
			redirect = redirect.replace(`:${key}`, req.params[key]);
		}

		res.status(301).redirect(redirect);
	});
}
