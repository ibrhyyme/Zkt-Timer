import React, {useEffect, useRef, useState} from 'react';
import './SolvePage.scss';
import {setSsrValue} from '../../actions/ssr';
import {gql} from '@apollo/client';
import {SOLVE_WITH_USER_FRAGMENT} from '../../util/graphql/fragments';
import {gqlQuery} from '../api';
import SolveInfo from '../solve_info/SolveInfo';
import Header from '../layout/header/Header';
import Empty from '../common/empty/Empty';
import Loading from '../common/loading/Loading';
import {getTimeString} from '../../util/time';
import {getCubeTypeInfoById, getCubeTypeBucketLabel} from '../../util/cubes/util';
import {Store} from 'redux';
import {Request} from 'express';
import {useSsr} from '../../util/hooks/useSsr';
import {useHistory, useRouteMatch} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import block from '../../styles/bem';
import {Solve} from '../../../server/schemas/Solve.schema';
import {QuerySolveByShareCodeArgs} from '../../@types/generated/graphql';
import {resourceUri} from '../../util/storage';
import {SsrMetaFn} from '../layout/Routes';

const b = block('solve-page');

// Shared solve links are pasted into WhatsApp/Instagram, where the square site logo
// gets cropped to a thumbnail. This is the Open Graph spec size (1200x630, 1.91:1)
// so the link renders as a full-width preview card instead.
// resourceUri already carries the /public base, so the path must NOT repeat it.
const SOLVE_SHARE_IMAGE = resourceUri('/images/og/solve-share.jpg');

async function fetchSolveData(shareCode: string) {
	const query = gql`
		${SOLVE_WITH_USER_FRAGMENT}
		query Query($shareCode: String) {
			solveByShareCode(shareCode: $shareCode) {
				...SolveWithUserFragment
			}
		}
	`;

	const res = await gqlQuery<{solveByShareCode: any}>(
		query,
		{
			shareCode,
		} as any,
		'no-cache'
	);

	return res.data.solveByShareCode;
}

export async function prefetchSolveData(store: Store<any>, req: Request) {
	const shareCode: string = req.params.shareCode;
	// Invalid/unknown share codes (and rate-limit/NOT_FOUND) must not crash SSR —
	// dispatch null so the page renders a "not found" state instead of a 500.
	try {
		const solve = await fetchSolveData(shareCode);
		return store.dispatch(setSsrValue(shareCode, solve ?? null));
	} catch {
		return store.dispatch(setSsrValue(shareCode, null));
	}
}

function buildShareVars(solve: any) {
	return {
		time: getTimeString(solve.time),
		cubeType: getCubeTypeBucketLabel(solve.cube_type, solve.scramble_subset) || getCubeTypeInfoById(solve.cube_type)?.name,
		user: solve.user?.username,
	};
}

/**
 * Server-side <head> tags for a shared solve. Runs after prefetchSolveData, so the
 * solve is already in the store. Without this the link preview falls back to the
 * generic site card — see SsrMeta in Routes.ts for why the component's own Header
 * cannot do this job.
 */
export const solveSsrMeta: SsrMetaFn = (store, req, t) => {
	const shareCode: string = req.params?.shareCode;
	const solve = store.getState()?.ssr?.[shareCode];

	if (!solve || !solve.user) {
		return {title: t('solve_page.not_found')};
	}

	const shareVars = buildShareVars(solve);
	return {
		title: t('solve_page.share_title', shareVars),
		description: t('solve_page.share_description', shareVars),
		image: SOLVE_SHARE_IMAGE,
	};
};

export default function SolvePage() {
	const {t} = useTranslation();
	const history = useHistory();
	const match = useRouteMatch<{shareCode: string}>();
	const shareCode = match.params.shareCode;
	const [solve, setSolve] = useSsr<Solve>(shareCode);

	// prefetchSolveData only runs on a full page load. Reaching this page through an
	// in-app <Link> (the solve feed) leaves the store empty, so fetch it here instead
	// of rendering "not found" for a solve that exists.
	const [fetching, setFetching] = useState(false);
	const attempted = useRef<string | null>(null);

	useEffect(() => {
		if (solve || !shareCode || attempted.current === shareCode) {
			return;
		}
		attempted.current = shareCode;
		setFetching(true);
		fetchSolveData(shareCode)
			.then((result) => setSolve(result ?? null))
			.catch(() => setSolve(null))
			.finally(() => setFetching(false));
	}, [shareCode, solve, setSolve]);

	if (!solve && fetching) {
		return (
			<div className={b()}>
				<Header path={`/solve/${shareCode}`} />
				<div className={b('body')}>
					<Loading />
				</div>
			</div>
		);
	}

	if (!solve || !solve.user) {
		return (
			<div className={b()}>
				<Header path={`/solve/${shareCode}`} title={t('solve_page.not_found')} />
				<div className={b('body')}>
					<Empty text={t('solve_page.not_found')} />
				</div>
			</div>
		);
	}

	// A 'wca' bucket solve is really its subset (3x3x3, Pyraminx...). Titling the
	// shared link "WCA" would say less than the page body already shows.
	const shareVars = buildShareVars(solve);

	return (
		<div className={b()}>
			<Header
				path={`/solve/${shareCode}`}
				title={t('solve_page.share_title', shareVars)}
				description={t('solve_page.share_description', shareVars)}
				featuredImage={SOLVE_SHARE_IMAGE}
			/>
			<div className={b('body')}>
				{/* Embedded rather than shown in a modal, so Done has to be told what
				    "done" means here: go back where you came from, which for a solve
				    shared in a chat is that conversation. Landing here from a shared
				    link has no history to pop, so fall back to the timer. */}
				<SolveInfo
					disabled
					solve={solve}
					solveId={solve?.id}
					onComplete={() => (history.length > 1 ? history.goBack() : history.push('/timer'))}
				/>
			</div>
		</div>
	);
}
