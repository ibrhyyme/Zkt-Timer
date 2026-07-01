import React from 'react';
import { useTranslation } from 'react-i18next';
import './SmartManage.scss';
import block from '../../../../../styles/bem';
import { SmartDevice } from '../../../../../@types/generated/graphql';

const b = block('manage-smart-cube');

interface Props {
	cube: SmartDevice;
}

export default function SmartManage(props: Props) {
	const { cube } = props;
	const { t } = useTranslation();
	const solveCount = cube.solves.length;

	return (
		<div className={b()}>
			<div className={b('left')}>
				<h4>{cube.name}</h4>
				<h5>{t('smart_cube.added_on', { date: new Date(cube.created_at).toDateString() })}</h5>
			</div>
			<div className={b('right')}>
				<p>{t('smart_cube.device_solve_count', { count: solveCount })}</p>
			</div>
		</div>
	);
}
