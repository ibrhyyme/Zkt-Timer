import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import ColorPicker from '../../../common/color_picker/ColorPicker';
import {useSettings} from '../../../../util/hooks/useSettings';
import {setSetting, setSettings} from '../../../../db/settings/update';
import {getTimeString} from '../../../../util/time';
import {
	normalizeSolveListColor,
	SOLVE_LIST_MIN_CONTRAST,
	SolveListColorKey,
	solveListColorContrast,
} from '../../../../util/themes/solve_list_colors';

interface Props {
	// Also read by TimerSettingsGroup's search filter, as on the built-in rows
	label: string;
	description: string;
	/** The PB colour only shows with "Highlight PBs" set to colour, so its picker hides otherwise. */
	showPb: boolean;
}

/**
 * The two solve list colours: the same ColorPicker the theme colours use, a preview on
 * the module colour the timer's history sits on, and a reset back to the theme.
 */
export default function SolveListColors({label, description, showPb}: Props) {
	const {t} = useTranslation();
	const solveTimeColor = useSettings('solve_time_color');
	const solvePbColor = useSettings('solve_pb_color');
	const secondaryColor = useSettings('secondary_color');
	const primaryColor = useSettings('primary_color');
	const moduleColor = useSettings('module_color');

	const saved: Record<SolveListColorKey, string | null> = {
		solve_time_color: normalizeSolveListColor(solveTimeColor),
		solve_pb_color: normalizeSolveListColor(solvePbColor),
	};
	// What the list falls back to while a colour is unset (see HistorySolveRow.scss)
	const theme: Record<SolveListColorKey, string | null> = {
		solve_time_color: normalizeSolveListColor(secondaryColor),
		solve_pb_color: normalizeSolveListColor(primaryColor),
	};

	const [openKey, setOpenKey] = useState<SolveListColorKey | null>(null);
	// Picked but not committed yet. Kept in a ref as well as rendered from state because
	// ColorPicker reports a click-away's colour and closes in the same tick, before a
	// state update from the first call would be visible to the second.
	const drafts = useRef<Partial<Record<SolveListColorKey, string>>>({});
	const [, setDraftVersion] = useState(0);
	// Set for the rest of the click that pressed reset. An open picker's click-away
	// handler still fires for that same click (its listener is refreshed in a passive
	// effect, so it holds the pre-reset closure) and reports its colour and a close,
	// which must not be committed back over the reset.
	const resetting = useRef(false);

	function current(key: SolveListColorKey): string | null {
		return saved[key] || theme[key];
	}

	function shown(key: SolveListColorKey): string | null {
		return normalizeSolveListColor(drafts.current[key]) || current(key);
	}

	function pick(key: SolveListColorKey, color: string) {
		if (resetting.current) return;
		drafts.current = {...drafts.current, [key]: color};
		setDraftVersion((v) => v + 1);
	}

	// Committed when the picker closes, not on every drag step: each write sends the
	// whole platform prefs blob to the server.
	function commit(key: SolveListColorKey) {
		const draft = normalizeSolveListColor(drafts.current[key]);
		const rest = {...drafts.current};
		delete rest[key];
		drafts.current = rest;
		setDraftVersion((v) => v + 1);

		// Opening and closing a picker reports its colour unchanged, and an unset colour
		// has to stay unset (following the theme) rather than become a copy of it.
		if (draft && draft !== current(key)) {
			setSetting(key, draft);
		}
	}

	function toggle(key: SolveListColorKey) {
		if (resetting.current) return;
		if (openKey === key) {
			commit(key);
			setOpenKey(null);
			return;
		}
		if (openKey) {
			commit(openKey);
		}
		setOpenKey(key);
	}

	function reset() {
		resetting.current = true;
		setTimeout(() => {
			resetting.current = false;
		}, 0);
		setOpenKey(null);
		drafts.current = {};
		setDraftVersion((v) => v + 1);
		// One write for both: they share the prefs blob
		setSettings({solve_time_color: null, solve_pb_color: null});
	}

	const visibleKeys: SolveListColorKey[] = showPb ? ['solve_time_color', 'solve_pb_color'] : ['solve_time_color'];
	const hasOverride = !!(saved.solve_time_color || saved.solve_pb_color);

	// Only a colour the user chose is judged: the theme's own pairings are its business.
	const lowContrast = visibleKeys.some((key) => {
		const chosen = normalizeSolveListColor(drafts.current[key]) || saved[key];
		if (!chosen) return false;
		const ratio = solveListColorContrast(chosen, moduleColor);
		return ratio !== null && ratio < SOLVE_LIST_MIN_CONTRAST;
	});

	function previewStyle(key: SolveListColorKey): React.CSSProperties {
		const color = shown(key);
		return color ? {color: `rgb(${color})`} : {};
	}

	return (
		<div className="py-4 px-4 rounded-xl bg-text/[0.035] border border-text/[0.09] hover:border-text/[0.15] transition-all duration-200">
			<div className="flex items-center justify-between mb-3">
				<div className="flex flex-col">
					<span className="font-medium text-text">{label}</span>
					<span className="text-xs text-text mt-0.5 leading-relaxed">{description}</span>
				</div>
				{hasOverride && (
					<button
						type="button"
						onClick={reset}
						className="shrink-0 ml-4 text-xs text-warning hover:text-warning/80 transition-colors cursor-pointer"
					>
						{t('appearance.reset')}
					</button>
				)}
			</div>
			<div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
				<ColorPicker
					openUp
					openLeft
					hideReset
					isOpen={openKey === 'solve_time_color'}
					onToggle={() => toggle('solve_time_color')}
					name={t('appearance.solve_time_color')}
					selectedColorHex={shown('solve_time_color')}
					onChange={(color) => pick('solve_time_color', color)}
				/>
				{showPb && (
					<ColorPicker
						openUp
						hideReset
						isOpen={openKey === 'solve_pb_color'}
						onToggle={() => toggle('solve_pb_color')}
						name={t('appearance.solve_pb_color')}
						selectedColorHex={shown('solve_pb_color')}
						onChange={(color) => pick('solve_pb_color', color)}
					/>
				)}
			</div>
			<div className="mt-3 flex items-center gap-5 rounded-lg bg-module px-3 py-2 font-semibold tabular-nums">
				<span style={previewStyle('solve_time_color')}>{getTimeString(12.34, 2)}</span>
				{showPb && <span style={previewStyle('solve_pb_color')}>{getTimeString(9.87, 2)}</span>}
			</div>
			{lowContrast && (
				<p className="mt-2 text-xs text-warning">{t('appearance.solve_colors_low_contrast')}</p>
			)}
		</div>
	);
}
