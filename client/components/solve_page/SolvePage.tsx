import React from 'react';
import './SolvePage.scss';
import {setSsrValue} from '../../actions/ssr';
import {gql} from '@apollo/client';
import {SOLVE_WITH_USER_FRAGMENT} from '../../util/graphql/fragments';
import {gqlQuery} from '../api';
import SolveInfo from '../solve_info/SolveInfo';
import Header from '../layout/header/Header';
import Empty from '../common/empty/Empty';
import {getTimeString} from '../../util/time';
import {getCubeTypeInfoById} from '../../util/cubes/util';
import {Store} from 'redux';
import {Request} from 'express';
import {useSsr} from '../../util/hooks/useSsr';
import {useRouteMatch} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import block from '../../styles/bem';
import {Solve} from '../../../server/schemas/Solve.schema';
import {QuerySolveByShareCodeArgs} from '../../@types/generated/graphql';

const b = block('solve-page');

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

export default function SolvePage() {
	const {t} = useTranslation();
	const match = useRouteMatch<{shareCode: string}>();
	const shareCode = match.params.shareCode;
	const [solve] = useSsr<Solve>(shareCode);

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

	const ct = getCubeTypeInfoById(solve.cube_type);
	const time = getTimeString(solve.time);
	const cubeType = ct.name;
	const user = solve.user.username;

	return (
		<div className={b()}>
			<Header
				path={`/solve/${shareCode}`}
				title={`${getTimeString(solve.time)} Solve for ${ct.name} by ${user} | Zkt Timer`}
				description={`View the details of this ${time} ${cubeType} solve by ${user}. Zkt Timer is the most advanced speedcubing timer, analytics, and trainer application.`}
			/>
			<div className={b('body')}>
				<SolveInfo disabled solve={solve} solveId={solve?.id} />
			</div>
		</div>
	);
}
