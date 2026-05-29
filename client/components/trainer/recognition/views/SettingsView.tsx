/**
 * SettingsView — cross color, view angle, stroke, color editor, variance, fullName, danger zone.
 * Desktop: 2-column grid layout: left form column + right preview/toggle column.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Lightning} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import SettingToggle from '../../options/SettingToggle';
import PllPic from '../components/PllPic';
import CrossColorPicker from '../components/CrossColorPicker';
import ColorToneEditor from '../components/ColorToneEditor';
import {useRecognitionContext} from '../RecognitionContext';
import {CubeViews, strokeWidthOptions, randomRotationOffset, type Rotation} from '../../../../util/trainer/recognition/cube_display';
import {mutateColorScheme, randomCrossColor} from '../../../../util/trainer/recognition/colors';
import {clearAllSessions} from '../../../../util/trainer/recognition/session_history';

const b = block('trainer-recognition');

// SSR-safe confirm: if window doesn't exist (server render), decline confirmation
function safeConfirm(message: string): boolean {
	if (typeof window === 'undefined') return false;
	return window.confirm(message);
}

export default function SettingsView() {
	const {t} = useTranslation();
	const {state, updateSettings, resetSettings, clearAllNotes, setRecognitionView} = useRecognitionContext();
	const settings = state.settings;

	const previewCase = useMemo(
		() => ({
			rotation: 'y2',
			name: 'Ja',
			dTurn: 'd2',
			colorShift: 0,
			crossColor: randomCrossColor(settings.allowedCrossColors),
		}),
		[settings.allowedCrossColors]
	);

	const rotationOverride = useMemo(
		() => (settings.angleVariance ? randomRotationOffset(settings.puzzleRotations) : null),
		[settings.angleVariance, settings.puzzleRotations]
	);
	const colorSchemeOverride = useMemo(
		() => (settings.colorVariance ? mutateColorScheme(settings.colorScheme) : null),
		[settings.colorVariance, settings.colorScheme]
	);

	function handleResetSettings() {
		if (safeConfirm(t('trainer.recognition.settings_reset_confirm', {defaultValue: 'Reset to defaults?'}))) {
			resetSettings();
		}
	}

	async function handleResetJourney() {
		if (
			safeConfirm(
				t('trainer.recognition.settings_clear_history_confirm', {
					defaultValue:
						'This will permanently delete all training history, personal bests, and quest progress. Continue?',
				})
			)
		) {
			await clearAllSessions();
			updateSettings({questStarted: false, activeQuestStepId: null});
		}
	}

	function handleClearAllNotes() {
		if (
			safeConfirm(
				t('trainer.recognition.settings_clear_notes_confirm', {
					defaultValue: 'This will permanently delete all your per-case notes. Continue?',
				})
			)
		) {
			clearAllNotes();
		}
	}

	const viewKeyByValue = (rot: Rotation[]) => {
		const found = Object.entries(CubeViews).find(
			([, v]) => v[0]?.x === rot[0]?.x && v[0]?.y === rot[0]?.y && v[0]?.z === rot[0]?.z
		);
		return found?.[0] || 'Center';
	};

	const toggles: {key: keyof typeof settings; label: string; help?: string}[] = [
		{
			key: 'showOnScreenKeyboard',
			label: t('trainer.recognition.settings_on_screen_keyboard', {defaultValue: 'On-screen keyboard'}),
		},
		{
			key: 'fullNameMode',
			label: t('trainer.recognition.settings_full_name_mode', {defaultValue: 'Full name mode'}),
			help: t('trainer.recognition.settings_full_name_mode_help', {
				defaultValue: 'Type full case name (e.g. Ga instead of just G)',
			}),
		},
		{
			key: 'angleVariance',
			label: t('trainer.recognition.settings_angle_variance', {defaultValue: 'Angle variance'}),
			help: t('trainer.recognition.settings_angle_variance_help', {
				defaultValue: 'Randomly rotate the cube angle for each new case',
			}),
		},
		{
			key: 'colorVariance',
			label: t('trainer.recognition.settings_color_variance', {defaultValue: 'Color variance'}),
			help: t('trainer.recognition.settings_color_variance_help', {
				defaultValue: 'Randomly shift cube colors for each new case',
			}),
		},
		{
			key: 'questMode',
			label: t('trainer.recognition.settings_quest_mode', {defaultValue: 'Quest mode'}),
			help: t('trainer.recognition.settings_quest_mode_help', {
				defaultValue: 'Show guided learning journey on home',
			}),
		},
	];

	return (
		<div className={b('settings')}>
			<h2 className={b('settings-title')}>{t('trainer.recognition.settings_title', {defaultValue: 'Settings'})}</h2>

			{/* VISUAL CARD: form fields + live preview */}
			<section className={b('settings-card')}>
				<header className={b('settings-card-header')}>
					{t('trainer.recognition.settings_card_visual', {defaultValue: 'Visual'})}
				</header>
				<div className={b('settings-visual')}>
					<div className={b('settings-visual-form')}>
						<div className={b('settings-section')}>
							<label className={b('settings-label')}>
								{t('trainer.recognition.settings_cross_color', {defaultValue: 'Cross color'})}
							</label>
							<CrossColorPicker
								value={settings.allowedCrossColors}
								onChange={(val) => updateSettings({allowedCrossColors: val})}
							/>
						</div>

						<div className={b('settings-row')}>
							<label className={b('settings-row-label')}>
								{t('trainer.recognition.settings_view', {defaultValue: 'View'})}
							</label>
							<select
								value={viewKeyByValue(settings.puzzleRotations)}
								onChange={(e) => updateSettings({puzzleRotations: CubeViews[e.target.value]})}
								className={b('select')}
							>
								{Object.keys(CubeViews).map((vn) => (
									<option key={vn} value={vn}>
										{vn}
									</option>
								))}
							</select>
						</div>

						<div className={b('settings-row')}>
							<label className={b('settings-row-label')}>
								{t('trainer.recognition.settings_stroke', {defaultValue: 'Stroke'})}
							</label>
							<select
								value={String(settings.strokeWidth)}
								onChange={(e) => updateSettings({strokeWidth: Number(e.target.value)})}
								className={b('select')}
							>
								{Object.entries(strokeWidthOptions).map(([label, val]) => (
									<option key={label} value={String(val)}>
										{label}
									</option>
								))}
							</select>
						</div>

						<div className={b('settings-row')}>
							<label className={b('settings-row-label')}>
								{t('trainer.recognition.settings_color_tones', {defaultValue: 'Color tones'})}
							</label>
							<ColorToneEditor colorScheme={settings.colorScheme} onChange={(cs) => updateSettings({colorScheme: cs})} />
						</div>
					</div>

					<div className={b('settings-visual-preview')}>
						<PllPic
							pllCase={previewCase}
							viewType="cube"
							size={240}
							clickable={false}
							crossColor={previewCase.crossColor}
							rotationOverride={rotationOverride}
							colorSchemeOverride={colorSchemeOverride}
							puzzleRotations={settings.puzzleRotations}
							strokeWidth={settings.strokeWidth}
							colorScheme={settings.colorScheme}
						/>
						<small className={b('settings-visual-preview-hint')}>
							{t('trainer.recognition.settings_preview_hint', {defaultValue: 'Live preview'})}
						</small>
					</div>
				</div>
			</section>

			{/* BEHAVIOR CARD: toggles 2-column */}
			<section className={b('settings-card')}>
				<header className={b('settings-card-header')}>
					{t('trainer.recognition.settings_card_behavior', {defaultValue: 'Behavior'})}
				</header>
				<div className={b('settings-toggles')}>
					{toggles.map((opt) => (
						<SettingToggle
							key={opt.key as string}
							label={opt.label}
							description={opt.help}
							checked={Boolean(settings[opt.key])}
							onChange={(next) => updateSettings({[opt.key]: next} as unknown as Partial<typeof settings>)}
						/>
					))}
				</div>
			</section>

			{/* Action row: Start Training prominent primary, Reset secondary pill */}
			<div className={b('settings-actions')}>
				<Button
					theme={CommonType.TRANSPARENT}
					className={b('eval-cta-secondary')}
					text={t('trainer.recognition.settings_reset', {defaultValue: 'Reset'})}
					onClick={handleResetSettings}
					noMargin
				/>
				<Button
					primary
					large
					glow
					icon={<Lightning weight="fill" />}
					className={b('settings-start-cta')}
					text={t('trainer.recognition.settings_start_training', {defaultValue: 'Start Training'})}
					onClick={() => setRecognitionView('setup')}
				/>
			</div>

			{/* Danger Zone card */}
			<section className={b('settings-danger-card')}>
				<header className={b('settings-danger-card-header')}>
					<span className={b('settings-danger-badge')}>!</span>
					<span>{t('trainer.recognition.settings_danger_zone', {defaultValue: 'Danger Zone'})}</span>
				</header>
				<div className={b('settings-danger-list')}>
					<div className={b('settings-danger-item')}>
						<Button
							theme={CommonType.TRANSPARENT}
							className={b('eval-cta-secondary', {danger: true})}
							text={t('trainer.recognition.settings_clear_history', {defaultValue: 'Clear All Training History'})}
							onClick={handleResetJourney}
							noMargin
						/>
						<small className={b('settings-danger-help')}>
							{t('trainer.recognition.settings_clear_history_help', {
								defaultValue: 'Clears all training history, personal bests, and quest progress',
							})}
						</small>
					</div>
					<div className={b('settings-danger-item')}>
						<Button
							theme={CommonType.TRANSPARENT}
							className={b('eval-cta-secondary', {danger: true})}
							text={t('trainer.recognition.settings_clear_notes', {defaultValue: 'Clear All Notes'})}
							onClick={handleClearAllNotes}
							noMargin
						/>
						<small className={b('settings-danger-help')}>
							{t('trainer.recognition.settings_clear_notes_help', {
								defaultValue: 'Removes all per-case recognition notes',
							})}
						</small>
					</div>
				</div>
			</section>
		</div>
	);
}
