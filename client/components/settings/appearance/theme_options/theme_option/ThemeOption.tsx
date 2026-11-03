import React from 'react';
import './ThemeOption.scss';
import block from '../../../../../styles/bem';
import jsonStr from 'json-stable-stringify';
import {Check} from 'phosphor-react';
import {setSettings} from '../../../../../db/settings/update';
import {useMe} from '../../../../../util/hooks/useMe';
import ProTag from '../../../../common/pro_tag/ProTag';
import {getSetting} from '../../../../../db/settings/query';
import {APP_THEME_PRESETS, PresetThemeValues} from '../../../../../util/themes/theme_consts';
import {isNotPro, isProEnabled} from '../../../../../util/pro';
import {useHistory} from 'react-router-dom';

const b = block('theme-option');

interface Props {
	theme: keyof PresetThemeValues;
}

export default function ThemeOption(props: Props) {
	const me = useMe();
	const history = useHistory();

	const theme = APP_THEME_PRESETS[props.theme];
	const selected = jsonStr(theme.values) === getCurrentTheme();
	const locked = theme.proOnly && isProEnabled() && isNotPro(me);

	function getCurrentTheme() {
		const currentVals = {};
		for (const key of Object.keys(theme.values)) {
			currentVals[key] = getSetting(key as any);
		}

		return jsonStr(currentVals);
	}

	function selectTheme() {
		if (locked) {
			history.push('/pro');
			return;
		}
		// One write: the colours share a single prefs blob server-side, so writing them
		// key by key raced and could persist a half-applied preset.
		setSettings(theme.values);
	}

	const {background_color, button_color, module_color, primary_color, secondary_color, text_color} = theme.values;
	const previewColors = {
		'--preview-bg': background_color,
		'--preview-button': button_color,
		'--preview-module': module_color,
		'--preview-primary': primary_color,
		'--preview-secondary': secondary_color,
		'--preview-text': text_color,
	} as React.CSSProperties;

	return (
		<button type="button" className={b({selected})} aria-pressed={selected} onClick={selectTheme}>
			{/* The theme shown as itself: a tiny timer in its own colours. */}
			<span className={b('preview')} style={previewColors} aria-hidden="true">
				<span className={b('strip')}>
					<span className={b('segment')} />
					<span className={b('segment')} />
					<span className={b('segment', {active: true})} />
				</span>
				<span className={b('digits')}>14.62</span>
				<span className={b('foot')}>
					<span className={b('primary')} />
					<span className={b('secondary')} />
				</span>
			</span>
			<span className={b('name')}>
				<span className={b('label')}>{theme.name}</span>
				{/* Says why it is locked: a bare lock read as "unavailable", not "comes with Pro". */}
				{locked ? <ProTag /> : null}
				{selected ? <Check weight="bold" className={b('check')} /> : null}
			</span>
		</button>
	);
}
