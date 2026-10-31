import React from 'react';
import {useDispatch} from 'react-redux';
import './CubeTypes.scss';
import {Trash, Plus} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {refreshSettings, setCubeType} from '../../../db/settings/update';
import {getAllCubeTypes, getScrambleTypeById} from '../../../util/cubes/util';
import {openModal} from '../../../actions/general';
import NewCubeType from './cube_cube_type/NewCubeType';
import {CubeType} from '../../../util/cubes/cube_types';
import Button from '../../common/button/Button';
import IconButton from '../../common/icon_button/IconButton';
import ConfirmModal from '../../common/confirm_modal/ConfirmModal';
import block from '../../../styles/bem';
import {gql} from '@apollo/client/core';
import {gqlMutate} from '../../api';
import {useSettings} from '../../../util/hooks/useSettings';

const b = block('manage-custom-cubes');

export default function CubeTypes() {
	const dispatch = useDispatch();
	const {t} = useTranslation();

	const currentCubeType = useSettings('cube_type');

	function addCustomCubeType() {
		dispatch(openModal(<NewCubeType />));
	}

	async function deleteCubeType(cubeType: CubeType) {
		const query = gql`
			mutation Mutate($id: String) {
				deleteCustomCubeType(id: $id) {
					id
				}
			}
		`;

		await gqlMutate(query, {
			id: cubeType.id,
		});

		if (currentCubeType === cubeType.id) {
			setCubeType('333');
		}

		await refreshSettings();

		window.location.reload();
	}

	function confirmDelete(cubeType: CubeType) {
		dispatch(
			openModal(
				<ConfirmModal
					buttonText={t('timer_settings.cube_types_delete_button')}
					triggerAction={() => deleteCubeType(cubeType)}
				/>,
				{
					title: t('timer_settings.cube_types_delete_title'),
					description: t('timer_settings.cube_types_delete_desc', {name: cubeType.name}),
					closeButtonText: t('solve_info.done'),
					compact: true,
					width: 420,
				}
			)
		);
	}

	// One row per type in the cube picker's vocabulary: name, scramble type under it, and a
	// bare trash glyph on the types the user made (the defaults cannot be deleted).
	function renderRow(cubeType: CubeType) {
		const scramble = getScrambleTypeById(cubeType.scramble);
		const custom = !cubeType.default;

		return (
			<div className={b('row')} key={cubeType.id}>
				<span className={b('text')}>
					<span className={b('name')}>
						<span>{cubeType.name}</span>
						{custom && <span className={b('badge')}>{t('timer_settings.cube_types_custom_badge')}</span>}
					</span>
					<span className={b('meta')}>{t('timer_settings.cube_types_scramble_meta', {name: scramble.name})}</span>
				</span>
				{custom && (
					<IconButton
						variant="ghost"
						size="sm"
						icon={<Trash />}
						label={t('timer_settings.cube_types_delete_button')}
						onClick={() => confirmDelete(cubeType)}
					/>
				)}
			</div>
		);
	}

	const all = getAllCubeTypes();
	const customTypes = all.filter((cubeType) => !cubeType.default);
	const defaultTypes = all.filter((cubeType) => cubeType.default);

	return (
		<div className={b()}>
			<div className={b('add')}>
				<Button text={t('common.create_new')} primary icon={<Plus weight="bold" />} onClick={addCustomCubeType} />
			</div>
			{customTypes.length > 0 && <div className={b('grid')}>{customTypes.map(renderRow)}</div>}
			<div className={b('grid')}>{defaultTypes.map(renderRow)}</div>
		</div>
	);
}
