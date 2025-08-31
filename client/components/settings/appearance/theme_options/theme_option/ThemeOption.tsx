import React from 'react';
import './ThemeOption.scss';
import block from '../../../../../styles/bem';
import jsonStr from 'json-stable-stringify';
import {useDispatch} from 'react-redux';
import {setSetting} from '../../../../../db/settings/update';
import {useMe} from '../../../../../util/hooks/useMe';
import Tag from '../../../../common/tag/Tag';
import {openModal} from '../../../../../actions/general';
import ProOnlyModal from '../../../../common/pro_only/ProOnlyModal';
import {Lock} from 'phosphor-react';
import {getSetting} from '../../../../../db/settings/query';
import {APP_THEME_PRESETS, PresetThemeValues} from '../../../../../util/themes/theme_consts';
import {isNotPro} from '../../../../../util/pro';

const b = block('theme-option');

interface Props {
	theme: keyof PresetThemeValues;
}

export default function ThemeOption(props: Props) {
	const dispatch = useDispatch();
	const me = useMe();

	const theme = APP_THEME_PRESETS[props.theme];
	const selected = jsonStr(theme.values) === getCurrentTheme();

	function getCurrentTheme() {
		const currentVals = {};
		for (const key of Object.keys(theme.values)) {
			currentVals[key] = getSetting(key as any);
		}

		return jsonStr(currentVals);
	}

	function selectTheme() {
		for (const key of Object.keys(theme.values)) {
			const col = theme.values[key];
			setSetting(key as any, col);
		}
	}

	// Pro features are now available to everyone
	let proLock = null;

	return (
		<button className={b({selected})} onClick={selectTheme}>
			<div className={b('preview')}>
				<div className={b('preview-body')}>
					<span
						style={{
							backgroundColor: 'rgb(' + theme.values.background_color + ')',
							border: '3px solid rgb(' + theme.values.text_color + ')',
						}}
					/>
					<span
						style={{
							backgroundColor: 'rgb(' + theme.values.module_color + ')',
						}}
					/>
				</div>
			</div>
			<p>{theme.name}</p>
			{proLock}
		</button>
	);
}
