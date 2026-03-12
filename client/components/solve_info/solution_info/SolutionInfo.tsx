import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './SolutionInfo.scss';
import CopyText from '../../common/copy_text/CopyText';
import { getSolveStepsWithoutParents } from '../util/solution';
import { getCrossRotation, transformMoves, simplifyMoves } from '../util/cross_rotation';
import { STEP_NAME_MAP } from '../util/consts';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';

const b = block('solve-info-solution-info');

interface Props {
	solve: Solve;
}

export default function SolutionInfo(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();
	const steps = getSolveStepsWithoutParents(solve);

	const crossStep = steps.find((s) => s.step_name === 'cross');
	const rotation = useMemo(
		() => (crossStep ? getCrossRotation(solve.scramble, crossStep.turns) : ''),
		[solve.scramble, crossStep?.turns]
	);

	const allTurnsWithRotation = steps.map((s) => {
		const isCross = s.step_name === 'cross';
		const transformed = simplifyMoves(rotation ? transformMoves(s.turns, rotation) : s.turns);
		if (!transformed) return null;
		const prefix = isCross && rotation ? `${rotation} ` : '';
		const label = STEP_NAME_MAP[s.step_name] || s.step_name;
		return `${prefix}${transformed} // ${label}`;
	}).filter(Boolean).join('\n');

	return (
		<div className={b()}>
			<table className={b('table')}>
				<thead>
					<tr>
						<th>{t('solve_info.step')}</th>
						<th>
							{t('solve_info.turns')}
							<CopyText
								text={allTurnsWithRotation}
								buttonProps={{ text: '' }}
							/>
						</th>
					</tr>
				</thead>
				<tbody>
					{steps.map((step) => {
						const isCross = step.step_name === 'cross';
						const transformed = simplifyMoves(rotation ? transformMoves(step.turns, rotation) : step.turns);

						return (
							<tr key={step.step_name}>
								<td className={b('step-name')}>{STEP_NAME_MAP[step.step_name] || step.step_name}</td>
								<td className={b('step-turns')}>
									{isCross && rotation && (
										<span className={b('rotation')}>{rotation}</span>
									)}
									{transformed}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
