import React, { ReactNode } from 'react';
import thunk from 'redux-thunk';
import ReactDOM from 'react-dom/server';
import promise from 'redux-promise-middleware';
import { applyMiddleware, createStore, Store } from 'redux';
import { Provider } from 'react-redux';
import { StaticRouter, Switch } from 'react-router-dom';
import { minify } from 'html-minifier';
import { PageContext, routes } from '../client/components/layout/Routes';
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

function renderFullPage(html, helmet, preloadedState, lang: string = 'tr') {
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

function createComponents(req, store) {
	// Detect language from cookie for SSR
	const lng = req.cookies?.zkt_language || 'tr';
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

	const markup = ReactDOM.renderToString(staticRouter);
	const helmet = Helmet.renderStatic();
	const preloaded = store.getState();

	// Get html and minify it
	const fullHtml = renderFullPage(markup, helmet, preloaded, lng);
	return minify(fullHtml, { collapseWhitespace: true, minifyJS: true, minifyCSS: true });
}

function appUseRouteForPage(routePath, route: PageContext) {
	global.app.all(routePath, async (req, res) => {
		const store = createStore(reducers, {}, applyMiddleware(promise(), thunk));
		const promises: ((store: Store<any>, req: Request) => Promise<any>)[] = route.prefetchData || [];
		const me = await initUserAccount(store, req);

		// Redirect from demo to timer if logged in
		if (routePath === '/demo' && me) {
			res.status(302).redirect('/timer');
			return;
		}

		// Redirect root route to timer if authenticated
		if (routePath === '/' && me) {
			res.status(302).redirect('/timer');
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

		// Redirect to home page if user is logged in and on login page
		if (me && (routePath === '/login' || routePath === '/signup')) {
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

			// GraphQL dışı hatalar için logla ve sayfayı prefetch verisi olmadan render et
			logger.warn('SSR prefetch failed, rendering without prefetched data', {
				path: routePath,
				error: e?.message || e,
			});
		}

		// Initiates the whole store
		const html = createComponents(req, store);

		if (!code) {
			code = 500;
			logger.warn('Invalid status code when trying to generate page', {
				path: routePath,
			});
		}

		if (!res.headersSent) {
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
