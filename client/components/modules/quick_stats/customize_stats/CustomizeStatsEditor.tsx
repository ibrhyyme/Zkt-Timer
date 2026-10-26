import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import colorPalette, { ColorName } from '../../../../../shared/colors';
import CustomizeStatsColor from './CustomizeStatsColor';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import ChoiceGroup, { ChoiceOption } from '../../../common/choice_group/ChoiceGroup';
import Button from '../../../common/button/Button';
import { closeModal } from '../../../../actions/general';
import { useMe } from '../../../../util/hooks/useMe';
import { isNotPro } from '../../../../lib/pro';
import { getStatLabel } from '../stat_label';
import {
	COUNT_PRESETS,
	getBlockCount,
	getBlockKind,
	getBlockValue,
	getKindValues,
	parseAverageCount,
	STATS_BLOCK_KINDS,
	StatsBlockKind,
	withBlockKind,
} from '../block_options';
import block from '../../../../styles/bem';

const b = block('customize-stats');

const COLOR_NAMES = Object.keys(colorPalette) as ColorName[];

interface Props {
	stat: StatsModuleBlock;
	canRemove: boolean;
	onChange: (next: StatsModuleBlock) => void;
	onRemove: () => void;
}

/** The settings of one stats block. Every change applies at once; nothing to confirm. */
export default function CustomizeStatsEditor(props: Props) {
	const { stat, canRemove, onChange, onRemove } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const history = useHistory();
	const me = useMe();

	const kind = getBlockKind(stat);
	const value = getBlockValue(stat);
	const count = getBlockCount(stat);
	const presets = COUNT_PRESETS[kind];
	const colorLocked = isNotPro(me);

	// A count that is not one of the chips shows in the box, so the user sees what is set.
	const [custom, setCustom] = useState(presets && count && !presets.includes(count) ? String(count) : '');
	const [customError, setCustomError] = useState(false);

	const { key, params } = getStatLabel(stat);

	function selectKind(next: StatsBlockKind) {
		setCustom('');
		setCustomError(false);
		onChange(withBlockKind(stat, next));
	}

	function selectCount(n: number) {
		setCustom('');
		setCustomError(false);
		onChange({ ...stat, averageCount: n });
	}

	function applyCustom(event?: React.FormEvent) {
		event?.preventDefault();
		if (!custom.trim()) {
			setCustomError(false);
			return;
		}
		const n = parseAverageCount(custom);
		if (n === null) {
			setCustomError(true);
			return;
		}
		setCustomError(false);
		if (n !== count) {
			onChange({ ...stat, averageCount: n });
		}
	}

	function goToPro() {
		dispatch(closeModal());
		history.push('/pro');
	}

	const kindOptions: ChoiceOption<StatsBlockKind>[] = STATS_BLOCK_KINDS.map((k) => ({
		value: k,
		label: t(`timer_modules.stat_editor.kinds.${k}`),
	}));

	const countOptions: ChoiceOption<number>[] = (presets || []).map((n) => ({
		value: n,
		label: n ? String(n) : t('timer_modules.stat_editor.count_all'),
	}));

	const valueOptions = getKindValues(kind).map((v) => ({
		value: v,
		label: t(`timer_modules.stat_editor.values.${v}`),
	}));

	const valueHelp = value === 'bpa' || value === 'wpa' || value === 'target';
	const prefix = kind === 'mo' ? 'mo' : 'ao';

	return (
		<div className={b('form')}>
			<h3 className={b('title')}>{t(key, params)}</h3>

			<div className={b('field')}>
				<span className={b('label')}>{t('timer_modules.stat_editor.kind')}</span>
				<ChoiceGroup
					label={t('timer_modules.stat_editor.kind')}
					options={kindOptions}
					value={kind}
					onChange={selectKind}
				/>
				<p className={b('note')}>{t(`timer_modules.stat_editor.kind_help.${kind}`)}</p>
			</div>

			{presets && (
				<div className={b('field')}>
					<span className={b('label')}>{t('timer_modules.stat_editor.count')}</span>
					<ChoiceGroup
						numeric
						label={t('timer_modules.stat_editor.count')}
						options={countOptions}
						value={presets.includes(count) ? count : null}
						onChange={selectCount}
					/>
					<form className={b('custom')} onSubmit={applyCustom}>
						<span className={b('custom-prefix')}>{prefix}</span>
						<input
							className={b('custom-input', { error: customError })}
							inputMode="numeric"
							value={custom}
							placeholder={t('timer_modules.solves_custom_placeholder')}
							aria-label={t('timer_modules.stat_editor.count_custom')}
							aria-invalid={customError}
							onChange={(event) => {
								setCustom(event.target.value);
								setCustomError(false);
							}}
							onBlur={() => applyCustom()}
						/>
					</form>
					<p className={b('note', { error: customError })}>{t('timer_modules.count_info')}</p>
				</div>
			)}

			{valueOptions.length > 0 && (
				<div className={b('field')}>
					<span className={b('label')}>{t('timer_modules.stat_editor.value')}</span>
					<ChoiceGroup
						label={t('timer_modules.stat_editor.value')}
						options={valueOptions}
						value={value}
						onChange={(v) => onChange({ ...stat, sortBy: v })}
					/>
					{valueHelp && <p className={b('note')}>{t(`timer_modules.stat_editor.value_help.${value}`)}</p>}
				</div>
			)}

			<div className={b('field')}>
				<span className={b('label')}>{t('timer_modules.stat_editor.scope')}</span>
				<ChoiceGroup
					label={t('timer_modules.stat_editor.scope')}
					options={[
						{ value: 'session', label: t('timer_modules.stat_editor.scope_session') },
						{ value: 'all', label: t('timer_modules.stat_editor.scope_all') },
					]}
					value={stat.session ? 'session' : 'all'}
					onChange={(v) => onChange({ ...stat, session: v === 'session' })}
				/>
			</div>

			<div className={b('field')}>
				<span className={b('label')}>
					{t('timer_modules.stat_editor.color')}
					{colorLocked && (
						<button type="button" className={b('pro')} onClick={goToPro}>
							PRO
						</button>
					)}
				</span>
				<div className={b('swatches')} role="radiogroup" aria-label={t('timer_modules.stat_editor.color')}>
					{COLOR_NAMES.map((cn) => (
						<CustomizeStatsColor
							key={`colorName-${cn}`}
							colorName={cn}
							selected={(stat.colorName || 'text') === cn}
							disabled={colorLocked}
							onSelectColor={(name) => onChange({ ...stat, colorName: name })}
						/>
					))}
				</div>
			</div>

			{canRemove && (
				<div className={b('remove')}>
					{/* Quiet on purpose: one block among several, put back with "Add block" */}
					<Button small outline onClick={onRemove} text={t('timer_modules.stat_editor.remove')} />
				</div>
			)}
		</div>
	);
}
