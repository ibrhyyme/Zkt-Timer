import '../i18n/i18n';
import React from 'react';
import 'seedrandom';
import thunk from 'redux-thunk';
import ReactDOM from 'react-dom';
import promise from 'redux-promise-middleware';
import { applyMiddleware, createStore } from 'redux';
import { Provider } from 'react-redux';
// Force HMR check
import { Route, Switch, useLocation, BrowserRouter as Router } from 'react-router-dom';
import { routes } from './layout/Routes';
import reducers from '../reducers/reducers';
import { setStore } from './store';
import { initApollo } from './api';

import 'react-toastify/dist/ReactToastify.css';

// Guard the parse: a shell served without SSR state (e.g. the SW's offline
// fallback page) must still boot the app instead of crashing the bundle.
let preloadedState = {};
try {
	preloadedState = JSON.parse(window.__STORE__ || '{}');
} catch (e) {
	console.warn('Invalid __STORE__, booting with empty state');
}
const store = createStore(reducers, preloadedState, applyMiddleware(promise(), thunk));

const apolloClient = initApollo();
setStore(store);

delete window.__STORE__;

import '../styles/index.scss';
import { mapSingleRoute } from './map_route';
import { ApolloProvider } from '@apollo/client';
import { DataProvider } from '../providers/DataProvider';

// No third-party error reporting. The Sentry init that stood here sent every
// page view and error to CubeDesk's Sentry organisation (inherited with the
// fork) and was removed on 2026-10-26; nothing replaces it by design.

ReactDOM.hydrate(
	<ApolloProvider client={apolloClient}>
		<Provider store={store as any}>
			<Router>
				<DataProvider>
					<Switch>{routes.map((route) => mapSingleRoute(route))}</Switch>
				</DataProvider>
			</Router>
		</Provider>
	</ApolloProvider>,
	document.getElementById('app')
);
/* eslint-enable */
