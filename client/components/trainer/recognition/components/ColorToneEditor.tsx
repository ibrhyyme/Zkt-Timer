/**
 * ColorToneEditor — 6 face color input + reset. Expand/collapse modu.
 */
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import {DefaultColorScheme, type ColorScheme} from '../../../../util/trainer/recognition/cube_display';

const b = block('trainer-recognition');

interface ColorToneEditorProps {
	colorScheme: ColorScheme;
	onChange: (scheme: ColorScheme) => void;
}

const FACES: {key: keyof ColorScheme; label: string}[] = [
	{key: 'U', label: 'Top (U)'},
	{key: 'D', label: 'Bottom (D)'},
	{key: 'F', label: 'Front (F)'},
	{key: 'B', label: 'Back (B)'},
	{key: 'L', label: 'Left (L)'},
	{key: 'R', label: 'Right (R)'},
];

export default function ColorToneEditor({colorScheme, onChange}: ColorToneEditorProps) {
	const {t} = useTranslation();
	const [expanded, setExpanded] = useState(false);

	function setFaceColor(face: keyof ColorScheme, value: string) {
		onChange({
			...colorScheme,
			[face]: {...colorScheme[face], value},
		});
	}

	function resetColors() {
		const next = {...colorScheme};
		for (const f of FACES) {
			next[f.key] = {...next[f.key], value: DefaultColorScheme[f.key].value};
		}
		onChange(next);
	}

	return (
		<div>
			<Button
				theme={expanded ? CommonType.GRAY : CommonType.PRIMARY}
				small
				text={
					expanded
						? t('trainer.recognition.settings_color_close', {defaultValue: 'Close'})
						: t('trainer.recognition.settings_color_customize', {defaultValue: 'Customize...'})
				}
				onClick={() => setExpanded((v) => !v)}
				noMargin
			/>

			{expanded && (
				<div className={b('color-editor')}>
					{FACES.map((f) => (
						<div key={f.key} className={b('color-row')}>
							<label className={b('color-row-label')}>{f.label}</label>
							<input
								type="color"
								value={colorScheme[f.key].value}
								onChange={(e) => setFaceColor(f.key, e.target.value)}
								className={b('color-input')}
							/>
						</div>
					))}
					<div>
						<Button
							theme={CommonType.TRANSPARENT}
							small
							text={t('trainer.recognition.settings_color_reset', {defaultValue: 'Reset to defaults'})}
							onClick={resetColors}
							noMargin
						/>
					</div>
				</div>
			)}
		</div>
	);
}
