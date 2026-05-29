/**
 * SessionSetupView — preset secimi + size secimi + start butonu.
 * Quest mode entegrasyonu: questStarted ise "Back to Quest" linki gosterilir.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {useDispatch as useReduxDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {CaretLeft, CaretRight, Plus, Lightning, ArrowLeft, Info} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import {openModal, closeModal} from '../../../../actions/general';
import PresetCard from '../components/PresetCard';
import CreatePresetModal from '../components/CreatePresetModal';
import {useRecognitionContext} from '../RecognitionContext';
import {useHorizontalScroll} from '../hooks/useHorizontalScroll';
import {useKeydown} from '../hooks/useKeydown';
import {usePresetPBs} from '../hooks/usePersonalBests';
import {presets, type Preset} from '../../../../util/trainer/recognition/session_presets';
import {
	SIZE_DEFAULT,
	SIZE_OPTIONS,
	SIZE_UNIQUE,
	computeSessionTotal,
	buildSessionPool,
} from '../../../../util/trainer/recognition/session_sizing';
import {presetKeys} from '../../../../util/trainer/recognition/session_presets';
import {allPllKeys} from '../../../../util/trainer/recognition/pll_cases';

const b = block('trainer-recognition');

export default function SessionSetupView() {
	const {t} = useTranslation();
	const {state, startSession, addPreset, removePreset, setRecognitionView, updateSettings} = useRecognitionContext();
	const reduxDispatch = useReduxDispatch();
	const {scrollRef, canScrollLeft, canScrollRight, scrollBy} = useHorizontalScroll();
	const [selectedPresetId, setSelectedPresetId] = useState('all');
	const [sizeOption, setSizeOption] = useState<number>(SIZE_DEFAULT);

	const {presetPBs} = usePresetPBs(sizeOption);

	const allPresets: Preset[] = useMemo(
		() => [...presets, ...state.presets.customPresets.map((p) => ({id: p.id, label: p.label, groups: p.groups}))],
		[state.presets.customPresets]
	);

	const findPreset = useCallback((id: string) => allPresets.find((p) => p.id === id), [allPresets]);

	const poolKeys = useMemo(() => {
		const preset = findPreset(selectedPresetId);
		return preset ? presetKeys(preset) : allPllKeys();
	}, [findPreset, selectedPresetId]);

	const sessionCaseCount = computeSessionTotal(poolKeys.length, sizeOption);

	const handleStartSession = useCallback(() => {
		const pool =
			sizeOption === SIZE_UNIQUE && selectedPresetId === 'all'
				? null
				: buildSessionPool(poolKeys, sizeOption);
		const label = findPreset(selectedPresetId)?.label || 'All Cases';
		startSession(pool, sizeOption, label);
		setRecognitionView('trainer');
	}, [selectedPresetId, sizeOption, poolKeys, startSession, setRecognitionView, findPreset]);

	useKeydown((e) => {
		if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
			const target = e.target as HTMLElement;
			if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
			e.preventDefault();
			handleStartSession();
		}
	});

	const handleOpenCreate = useCallback(() => {
		reduxDispatch(
			openModal(
				<CreatePresetModal
					onSave={(label, ids) => {
						const preset = addPreset(label, ids);
						setSelectedPresetId(preset.id);
					}}
					onClose={() => reduxDispatch(closeModal())}
				/>,
				{
					title: t('trainer.recognition.preset_create_title', {defaultValue: 'Create Custom Preset'}),
					width: 720,
					compact: true,
				}
			)
		);
	}, [reduxDispatch, addPreset, t]);

	const handleDeletePreset = useCallback(
		(id: string) => {
			if (selectedPresetId === id) setSelectedPresetId('all');
			removePreset(id);
		},
		[selectedPresetId, removePreset]
	);

	const questActive = state.settings.questMode && state.settings.questStarted;
	const sizeWarn = sizeOption === SIZE_UNIQUE;

	return (
		<div className={b('setup')}>
			{questActive && (
				<div className={b('setup-back')}>
					<Button
						theme={CommonType.TRANSPARENT}
						small
						icon={<ArrowLeft />}
						text={t('trainer.recognition.setup_back_to_quest', {defaultValue: 'Back to Quest'})}
						className={b('btn-pill')}
						onClick={() => {
							updateSettings({activeQuestStepId: null});
							setRecognitionView('home');
						}}
						noMargin
					/>
				</div>
			)}

			<div className={b('setup-header')}>
				<h3 className={b('setup-header-title')}>
					{t('trainer.recognition.setup_title', {defaultValue: 'Session Setup'})}
				</h3>
				<p className={b('setup-header-subtitle')}>
					{t('trainer.recognition.setup_subtitle', {defaultValue: 'Choose which patterns to practice'})}
				</p>
			</div>

			<div className={b('help-box')}>
				<Info weight="fill" className={b('help-box-icon')} />
				<div className={b('help-box-body')}>
					{t('trainer.recognition.setup_info', {
						defaultValue:
							'Bir preset seç, oturum boyutunu belirle ve başla. Her oturum sonunda istatistiklerin kaydedilir, zayıf kaselerini "Personalized Training" ile daha sık tekrar edebilirsin.',
					})}
				</div>
			</div>

			<div className={b('setup-layout')}>
				<div className={b('setup-main')}>
					<div className={b('preset-scroll-wrapper')}>
						{canScrollLeft && (
							<button
								type="button"
								className={b('preset-arrow', {left: true})}
								onClick={() => scrollBy(-1)}
								title={t('trainer.recognition.setup_scroll_left', {defaultValue: 'Scroll left'})}
							>
								<CaretLeft />
							</button>
						)}
						{canScrollRight && (
							<button
								type="button"
								className={b('preset-arrow', {right: true})}
								onClick={() => scrollBy(1)}
								title={t('trainer.recognition.setup_scroll_right', {defaultValue: 'Scroll right'})}
							>
								<CaretRight />
							</button>
						)}
						<div className={b('preset-scroll')} ref={scrollRef}>
							<div className={b('preset-grid')}>
								{allPresets.map((preset) => (
									<PresetCard
										key={preset.id}
										preset={preset}
										selected={selectedPresetId === preset.id}
										deletable={preset.id.startsWith('custom_')}
										pb={presetPBs.get(preset.id) || null}
										onSelect={() => setSelectedPresetId(preset.id)}
										onDelete={() => handleDeletePreset(preset.id)}
										deleteTitle={t('trainer.recognition.preset_delete', {defaultValue: 'Delete preset'})}
									/>
								))}
								<div
									className={b('preset-card', {add: true})}
									onClick={handleOpenCreate}
									role="button"
									tabIndex={0}
								>
									<Plus weight="bold" style={{fontSize: '2rem', opacity: 0.5}} />
									<small style={{marginTop: 6}}>
										{t('trainer.recognition.setup_add_custom', {defaultValue: 'Custom'})}
									</small>
								</div>
							</div>
						</div>
					</div>
				</div>

				<aside className={b('setup-sticky')}>
					<div className={b('size-selector')}>
						<div className={b('size-label')}>
							{t('trainer.recognition.setup_size_label', {defaultValue: 'Session size'})}
						</div>
						<div className={b('size-options')}>
							{SIZE_OPTIONS.map((opt) => (
								<button
									key={opt}
									type="button"
									className={b('size-option', {active: sizeOption === opt})}
									onClick={() => setSizeOption(opt)}
								>
									{computeSessionTotal(poolKeys.length, opt)}
								</button>
							))}
						</div>
						<div className={b('size-help', {warn: sizeWarn})}>
							{sizeWarn
								? t('trainer.recognition.setup_size_help_unique', {
										defaultValue: 'No duplicates — session order becomes predictable',
								  })
								: t('trainer.recognition.setup_size_help_default', {
										defaultValue: 'Extra cases are random duplicates to make it less predictable',
								  })}
						</div>
					</div>

					<div className={b('setup-cta')}>
						<Button
							primary
							large
							fullWidth
							icon={<Lightning weight="fill" />}
							text={t('trainer.recognition.setup_start_button', {
								count: sessionCaseCount,
								defaultValue: `Start Session (${sessionCaseCount})`,
							})}
							onClick={handleStartSession}
						/>
						<div className={b('home-cta-hint')}>
							{t('trainer.recognition.setup_press_space', {defaultValue: 'Press Space to start'})}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
