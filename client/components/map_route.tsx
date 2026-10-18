import { Redirect, Route } from 'react-router-dom';
import React from 'react';
import { fillRedirectParams, mergeRedirectQuery } from '../../shared/redirect_query';

/**
 * In-app side of a `routeRedirect` row. A full page load never gets here (the server answers
 * with a 301 first, server/router.tsx), but an old address reached through in-app history or a
 * notification link does. The row has no `parent`, so rendering it like a page crashed React.
 * Query and hash survive the same way as on the server (shared/redirect_query.ts).
 */
function LegacyRedirect({ to, match, location }) {
	const target = fillRedirectParams(to, match?.params);
	const merged = mergeRedirectQuery(target, location?.search);
	return <Redirect to={location?.hash && !merged.includes('#') ? `${merged}${location.hash}` : merged} />;
}

export function mapSingleRoute(route) {
	route.exact = true;

	if (route.redirect) {
		return (
			<Route
				key={route.path}
				path={route.path}
				exact
				render={(props) => <LegacyRedirect to={route.redirect} match={props.match} location={props.location} />}
			/>
		);
	}

	return (
		<Route
			key={route.groupKey || route.path}
			{...route}
			render={(props) => {
				const Child = route.child;
				const Parent = route.parent;

				const passProps = {
					...props,
					...route,
				};

				if (route.grandparent) {
					const GrandParent = route.grandparent;

					return (
						<GrandParent {...passProps}>
							<Parent {...passProps}>{Child ? <Child {...passProps} /> : null}</Parent>
						</GrandParent>
					);
				}

				return <Parent {...passProps}>{Child ? <Child {...passProps} /> : null}</Parent>;
			}}
		/>
	);
}
