import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'phosphor-react';
import block from '../../../styles/bem';
import { buildBucketFilter, fetchSolves } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { getTimeString } from '../../../util/time';
import { getSolveStanding } from '../util/solve_standing';
import { Solve } from '../../../../server/schemas/Solve.schema';
import './SolveStanding.scss';

const b = block('solve-standing');

interface Props {
	/** The solve's row on this device: the history it is measured against is this device's. */
	solve: Solve;
}

/**
 * The line under a solve's time on its card: a record, or how it compares with the solves
 * just before it. Answers "was that a good one?", which the time alone does not.
 */
export default function SolveStanding({ solve }: Props) {
	const { t } = useTranslation();
	const solveDbVersion = useSolveDb();

	const standing = useMemo(() => {
		const sessionFilter = buildBucketFilter({
			session_id: solve.session_id,
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset,
		});
		// The record counts every session; the recent comparison only this one.
		const bucketFilter = { ...sessionFilter };
		delete bucketFilter.session_id;
		return getSolveStanding(solve, fetchSolves(bucketFilter), fetchSolves(sessionFilter));
	}, [solve.id, solve.time, solve.dnf, solve.session_id, solve.cube_type, solve.scramble_subset, solveDbVersion]);

	if (!standing) return null;

	if (standing.kind === 'pb') {
		return (
			<div className={b({ pb: true })}>
				<Trophy weight="fill" />
				<span>{t('solve_info.standing_pb')}</span>
			</div>
		);
	}

	const faster = standing.diff < 0;
	const vars = { diff: getTimeString(Math.abs(standing.diff), 2), count: standing.count };
	return (
		<div className={b({ faster, slower: !faster })}>
			{t(faster ? 'solve_info.standing_faster' : 'solve_info.standing_slower', vars)}
		</div>
	);
}
