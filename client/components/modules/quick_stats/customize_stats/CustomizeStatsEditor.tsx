import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HorizontalNav from '../../../common/horizontal_nav/HorizontalNav';
import { useToggle } from '../../../../util/hooks/useToggle';
import { Check } from 'phosphor-react';
import Input from '../../../common/inputs/input/Input';
import Checkbox from '../../../common/checkbox/Checkbox';
import InputLegend from '../../../common/inputs/input/input_legend/InputLegend';
import colorPalette, { ColorName } from '../../../../../shared/colors';
import CustomizeStatsColor from './CustomizeStatsColor';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import ProOnly from '../../../common/pro_only/ProOnly';
import { getStatsBlockDescription, saveStatsModuleBlocks } from '../util';
import { useDispatch } from 'react-redux';
import { updateStatsModuleBlock } from '../../../../actions/stats';
import Tag from '../../../common/tag/Tag';
import Button from '../../../common/button/Button';
import FormSection from '../../../common/form/FormSection';

interface Props {
	hideRemoveButton?: boolean;
	removeStatsBlock: (index: number) => void;
	index: number;
	stat: StatsModuleBlock;
}

export default function CustomizeStatsEditor(props: Props) {
	const { t } = useTranslation();
	const { stat, index, removeStatsBlock, hideRemoveButton } = props;

	const effectiveAverageCountStr = String(
		typeof stat?.averageCount === 'number' ? Math.max(stat.averageCount, 0) : 50
	);

	const dispatch = useDispatch();
	const currentIndex = useRef<number | null>(null);
	const saveStatusTimer = useRef<NodeJS.Timeout | undefined>(undefined);
	const [averageAll, setAverageAll] = useState<boolean>(effectiveAverageCountStr === '0');
	const [savedStatus, setSavedStatus] = useState<null | 'saved' | 'saving'>();
	const [error, setError] = useState<string>(null);
	const colorNames = Object.keys(colorPalette) as ColorName[];
	const [statType, setStatType] = useState(stat.statType);
	const [sortBy, setSortBy] = useState(stat.sortBy);
	const [session, toggleSession] = useToggle(stat.session);
	const [colorName, setColorName] = useState<ColorName>(stat.colorName || 'text');
	const [averageCount, setAverageCount] = useState<string>(effectiveAverageCountStr);
	const [averageCountInt, setAverageCountInt] = useState<number>(parseInt(effectiveAverageCountStr, 10));

	const description = getStatsBlockDescription(stat);

	useEffect(() => {
		if (currentIndex.current !== index) {
			currentIndex.current = index;
			return;
		}

		setSavedStatus('saving');
		if (saveStatusTimer?.current) {
			clearTimeout(saveStatusTimer.current);
		}

		// Timeout to allow store to update
		setTimeout(async () => {
			const updatedStat: StatsModuleBlock = {
				colorName,
				statType,
				sortBy,
				session,
				averageCount: Math.max(0, averageCountInt),
			};

			dispatch(updateStatsModuleBlock(index, updatedStat));

			try {
				await saveStatsModuleBlocks();
				setSavedStatus('saved');
			} catch (e) {
				setError(t('timer_modules.error_save_failed'));
			}
		}, 100);

		saveStatusTimer.current = setTimeout(() => {
			setSavedStatus(null);
		}, 2000);
	}, [colorName, index, session, statType, averageCountInt, sortBy]);

	function selectStatType(val: string) {
		setStatType(val as any);

		if (val !== 'average' && sortBy === 'current') {
			setSortBy('best');
		}
	}

	function toggleSetAverageAll() {
		const newAverageAll = !averageAll;

		if (newAverageAll) {
			setAverageCount('0');
			setSortBy('current');
		}

		setAverageAll(newAverageAll);
		blurAverageCount();
	}

	function blurAverageCount() {
		setError(null);

		try {
			const avgInt = parseInt(averageCount, 10);
			setAverageCountInt(avgInt);
		} catch (e) {
			setError(t('timer_modules.error_invalid_count'));
		}
	}

	function onSelectColor(colorName: ColorName) {
		if (!colorNames.includes(colorName)) {
			setError(t('timer_modules.error_invalid_color'));
			return;
		}

		setColorName(colorName);
	}

	function selectPresetAverageOf(num: number) {
		setAverageCount(String(num));
		setAverageCountInt(num);
	}

	let averageCountDiv = null;
	if (statType === 'average') {
		const avgCountClasses = [];
		if (averageAll) {
			avgCountClasses.push('pointer-events-none');
			avgCountClasses.push('opacity-50');
		}

		averageCountDiv = (
			<FormSection>
				<InputLegend text={t('timer_modules.average_type')} />
				<div>
					<Checkbox text={t('timer_modules.overall_average')} checked={averageAll} onChange={() => toggleSetAverageAll()} />
				</div>
				<div className="my-2 opacity-80">
					<Tag text={t('timer_modules.stat_or')} textColor="text" />
				</div>
				<div className={avgCountClasses.join(' ')}>
					<Input
						value={averageCount}
						legend={t('timer_modules.specific_count')}
						info={t('timer_modules.count_info')}
						type="number"
						onChange={(e) => setAverageCount(e.target.value)}
						onBlur={blurAverageCount}
					/>
					<div className="mt-2 flex flex-row flex-wrap gap-2">
						<Button round text="5" secondary onClick={() => selectPresetAverageOf(5)} />
						<Button round text="10" secondary onClick={() => selectPresetAverageOf(10)} />
						<Button round text="12" secondary onClick={() => selectPresetAverageOf(12)} />
						<Button round text="25" secondary onClick={() => selectPresetAverageOf(25)} />
						<Button round text="50" secondary onClick={() => selectPresetAverageOf(50)} />
						<Button round text="100" secondary onClick={() => selectPresetAverageOf(100)} />
						<Button round text="250" secondary onClick={() => selectPresetAverageOf(250)} />
						<Button round text="500" secondary onClick={() => selectPresetAverageOf(500)} />
						<Button round text="1,000" secondary onClick={() => selectPresetAverageOf(1000)} />
					</div>
				</div>
			</FormSection>
		);
	}

	const colorOptions = colorNames.map((cn) => (
		<CustomizeStatsColor
			selected={colorName === cn}
			key={`colorName-${cn}`}
			colorName={cn}
			onSelectColor={onSelectColor}
		/>
	));

	let saveDiv = null;
	if (savedStatus === 'saved') {
		saveDiv = <Tag textColor="green" text={t('timer_modules.saved')} icon={<Check weight="bold" />} />;
	} else if (savedStatus === 'saving') {
		saveDiv = <Tag textColor="orange" text={t('timer_modules.saving')} />;
	}

	return (
		<div className="relative">
			<div className="absolute top-0 right-0 flex flex-row gap-3">{saveDiv}</div>
			<div className="flex flex-col">
				<div className="w-full">
					<h3 className="w-full text-center capitalize text-text/80">{description}</h3>
					{error && <p className="mt-2 text-error/80">{error}</p>}
				</div>
				<FormSection removePaddingTop>
					<HorizontalNav
						showBackgroundForUnselectedTabs
						legend={t('timer_modules.stat_type')}
						tabId={statType}
						onChange={(val) => selectStatType(val)}
						tabs={[
							{ id: 'single', value: t('timer_modules.stat_single') },
							{ id: 'average', value: t('timer_modules.stat_average') },
						]}
					/>
				</FormSection>
				{averageCountDiv}
				<FormSection>
					<HorizontalNav
						showBackgroundForUnselectedTabs
						legend={t('timer_modules.stat_result')}
						tabId={sortBy}
						onChange={(val) => setSortBy(val as any)}
						tabs={[
							{ id: 'current', value: t('timer_modules.stat_current'), skip: statType !== 'average' },
							{ id: 'best', value: t('timer_modules.stat_best') },
							{ id: 'worst', value: t('timer_modules.stat_worst') },
						]}
					/>
				</FormSection>
				<FormSection>
					<InputLegend text={t('timer_modules.options')} />
					<Checkbox text={t('timer_modules.session_solves_only')} checked={session} onChange={() => toggleSession()} />
				</FormSection>
				<FormSection proOnly>
					<InputLegend text={t('timer_modules.stat_color')} />
					<div className="flex flex-row flex-wrap gap-2">{colorOptions}</div>
				</FormSection>
				<div className="mt-3">
					<Button
						hidden={hideRemoveButton}
						flat
						text={t('timer_modules.remove')}
						danger
						onClick={(e) => {
							e.stopPropagation();
							e.preventDefault();
							removeStatsBlock(index);
						}}
					/>
				</div>
			</div>
		</div>
	);
}
