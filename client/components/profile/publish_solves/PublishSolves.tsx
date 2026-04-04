import React, {useState} from 'react';
import { useTranslation } from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {useMe} from '../../../util/hooks/useMe';
import {getSinglePB} from '../../../db/solves/stats/solves/single/single_pb';
import {getAveragePB} from '../../../db/solves/stats/solves/average/average_pb';
import {IModalProps} from '../../common/modal/Modal';
import {getTimeString} from '../../../util/time';
import block from '../../../styles/bem';
import {getCubeTypeInfoById} from '../../../util/cubes/util';
import Button from '../../common/button/Button';
import {fetchAllCubeTypesSolved, FilterSolvesOptions} from '../../../db/solves/query';
import {toastError, toastSuccess} from '../../../util/toast';
import {isProEnabled, isPro} from '../../../lib/pro';
import ProOnlyModal from '../../common/pro_only/ProOnlyModal';
import './PublishSolves.scss';

const b = block('publish-solves');

export default function PublishSolves(props: IModalProps) {
	const { t } = useTranslation();
	const {onComplete} = props;

	const cubeTypes = fetchAllCubeTypesSolved(true);

	const me = useMe();
	const [publishing, setPublishing] = useState(false);
	const [error, setError] = useState('');

	function getFilter(ct: string): FilterSolvesOptions {
		return {
			from_timer: true,
			cube_type: ct,
		};
	}

	async function publishTimes() {
		if (publishing) {
			return;
		}

		setPublishing(true);
		setError('');

		let errorCount = 0;
		let successCount = 0;

		for (const type of cubeTypes) {
			const pb = getSinglePB(getFilter(type.cube_type));
			const ao5Pb = getAveragePB(getFilter(type.cube_type), 5);

			try {
				if (pb && pb.time > 0) {
					const query = gql`
						mutation Mutation($solveId: String) {
							publishTopSolve(solveId: $solveId) {
								id
							}
						}
					`;

					await gqlMutate(query, {
						solveId: pb.solve.id,
					});

					successCount++;
				}
			} catch (e) {
				errorCount += 1;
				toastError(e.message);
			}

			try {
				if (ao5Pb && ao5Pb.time > 0) {
					const query = gql`
						mutation Mutation($solveIds: [String]) {
							publishTopAverages(solveIds: $solveIds) {
								id
							}
						}
					`;

					await gqlMutate(query, {
						solveIds: Array.from(ao5Pb.solveIds),
					});

					successCount++;
				}
			} catch (e) {
				errorCount += 1;
				toastError(e.message);
			}
		}

		setPublishing(false);
		if (!errorCount) {
			onComplete();
		} else if (successCount) {
			toastSuccess(`Published ${successCount} item${successCount === 1 ? '' : 's'}`);
		}
	}

	const rows = [];
	for (const type of cubeTypes) {
		const pb = getSinglePB(getFilter(type.cube_type));
		const ao5pb = getAveragePB(getFilter(type.cube_type), 5);

		if (!pb && !ao5pb) {
			continue;
		}

		const ct = getCubeTypeInfoById(type.cube_type);

		rows.push(
			<div key={type.cube_type} className={b('card')}>
				<div className={b('card-label')}>{ct.name}</div>
				<div className={b('card-values')}>
					<div className={b('card-stat')}>
						<span className={b('card-stat-label')}>{t('profile.single')}</span>
						<span className={b('card-stat-value')}>{pb ? getTimeString(pb.time) : '—'}</span>
					</div>
					<div className={b('card-stat')}>
						<span className={b('card-stat-label')}>{t('profile.average')}</span>
						<span className={b('card-stat-value')}>{ao5pb ? getTimeString(ao5pb.time) : '—'}</span>
					</div>
				</div>
			</div>
		);
	}

	if (isProEnabled() && !isPro(me)) {
		return <ProOnlyModal />;
	}

	let exception = null;
	if (!me.username) {
		exception = (
			<div className={b('exception')}>
				{t('profile.set_username_first')} <a href="/account/personal-info">{t('profile.set_username_link')}</a>
			</div>
		);
	} else if (!rows.length) {
		exception = (
			<div className={b('exception')}>
				{t('profile.no_solves_to_publish')} <a href="/">{t('profile.timer_page')}</a>
			</div>
		);
	}

	return (
		<div className={b()}>
			{exception}
			{exception ? null : (
				<>
					<div className={b('list')}>
						{rows}
					</div>
					<div className={b('actions')}>
						<Button
							primary
							glow
							large
							text={t('profile.publish_to_profile')}
							error={error}
							loading={publishing}
							onClick={publishTimes}
						/>
					</div>
				</>
			)}
		</div>
	);
}
