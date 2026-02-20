import React, {useContext} from 'react';
import './CustomMatchOptions.scss';
import block from '../../../../../../styles/bem';
import {ArrowRight} from 'phosphor-react';
import HorizontalNav from '../../../../../common/horizontal_nav/HorizontalNav';
import {MatchPopupContext, MatchPopupPage} from '../../MatchPopup';
import CubePicker from '../../../../../common/cube_picker/CubePicker';
import {CubeType} from '../../../../../../util/cubes/cube_types';
import Button from '../../../../../common/button/Button';
import {useTranslation} from 'react-i18next';

const b = block('custom-match-options');

export default function CustomMatchOptions() {
	const context = useContext(MatchPopupContext);
	const {t} = useTranslation();

	function selectPlayerCount(val: string) {
		const count = parseInt(val);
		context.setMaxPlayers(count);
		context.setMinPlayers(count);
	}

	function selectCubeType(ct: CubeType) {
		context.setCubeType(ct.id);
	}

	function createMatch() {
		context.setPage(MatchPopupPage.CUSTOM);
	}

	return (
		<div className={b()}>
			<div className={b('option')}>
				<div className={b('label')}>
					<h3>{t('match.cube_type')}</h3>
				</div>
				<CubePicker
					excludeCustomCubeTypes
					excludeOtherCubeType
					value={context.cubeType}
					onChange={selectCubeType}
					dropdownProps={{
						openLeft: true,
						dropdownButtonProps: {
							primary: true,
							large: true,
							glow: true,
						},
					}}
				/>
			</div>
			<div className={b('option')}>
				<div className={b('label')}>
					<h3>{t('match.players')}</h3>
					<p>
						{t('match.players_description')}
					</p>
				</div>
				<HorizontalNav
					tabId={String(context.minPlayers)}
					onChange={selectPlayerCount}
					tabs={[2, 3, 4, 5, 6].map((num) => ({
						id: String(num),
						value: String(num),
					}))}
				/>
			</div>
			<div className={b('actions')}>
				<Button onClick={createMatch} text={t('match.create_custom_match')} icon={<ArrowRight />} primary glow large />
			</div>
		</div>
	);
}
