import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock } from 'phosphor-react';
import { useDispatch } from 'react-redux';
import { openModal } from '../../actions/general';
import { useSettings } from '../../util/hooks/useSettings';
import { setSetting, toggleSetting } from '../../db/settings/update';
import { AllSettings } from '../../db/settings/query';
import StackMatPicker from '../settings/stackmat_picker/StackMatPicker';
import screenfull from '../../util/vendor/screenfull';
import './RoomSettingsModal.scss';

// TimerTab.tsx'ten alınan özel TimerOption stili
interface TimerOptionProps {
    label: string | React.ReactNode;
    isActive: boolean;
    disabled?: boolean;
    onClick: () => void;
}

function TimerOption({ label, isActive, disabled = false, onClick }: TimerOptionProps) {
    return (
        <div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-700/30 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-black/10">
            <span className={`font-medium transition-colors ${disabled ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
                {label}
            </span>
            <button
                type="button"
                disabled={disabled}
                className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-indigo-400 shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-600/50 border-slate-500/50 hover:bg-slate-500/50'
                    } ${disabled ? 'opacity-30 cursor-not-allowed transform-none' : 'cursor-pointer'}`}
                onClick={onClick}
            >
                <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${isActive ? 'translate-x-5 shadow-white/20' : 'translate-x-0.5'
                        }`}
                />
            </button>
        </div>
    );
}

// ExtrasTab.tsx'ten alınan ExtrasOption stili
interface ExtrasOptionProps {
    label: string;
    isActive: boolean;
    disabled?: boolean;
    hidden?: boolean;
    onClick: () => void;
}

function ExtrasOption({ label, isActive, disabled = false, hidden = false, onClick }: ExtrasOptionProps) {
    if (hidden) {
        return null;
    }

    return (
        <div className="group flex items-center justify-between py-4 px-4 rounded-xl bg-gradient-to-r from-slate-800/30 to-slate-700/30 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 hover:shadow-lg hover:shadow-black/10">
            <span className={`font-medium transition-colors ${disabled ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
                {label}
            </span>
            <button
                type="button"
                disabled={disabled}
                className={`relative h-6 w-11 rounded-full border transition-all duration-300 transform hover:scale-105 ${isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 shadow-lg shadow-emerald-500/30'
                    : 'bg-slate-600/50 border-slate-500/50 hover:bg-slate-500/50'
                    } ${disabled ? 'opacity-30 cursor-not-allowed transform-none' : 'cursor-pointer'}`}
                onClick={onClick}
            >
                <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ${isActive ? 'translate-x-5 shadow-white/20' : 'translate-x-0.5'
                        }`}
                />
            </button>
        </div>
    );
}

interface RoomSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    cubeType?: string;
    allowedTimerTypes?: string[];
}

export default function RoomSettingsModal({ isOpen, onClose, cubeType, allowedTimerTypes }: RoomSettingsModalProps) {
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState<'timer' | 'extras'>('timer');

    const inspection = useSettings('inspection');
    const timerType = useSettings('timer_type');
    const manualEntry = useSettings('manual_entry');
    const focusMode = useSettings('focus_mode');

    const [fullScreenMode, setFullScreenMode] = useState(false);

    // Track fullscreen state
    if (screenfull.isEnabled) {
        useEffect(() => {
            const updateFullScreenState = () => setFullScreenMode(screenfull.isFullscreen);
            updateFullScreenState();
            screenfull.on('change', updateFullScreenState);
            return () => screenfull.off('change', updateFullScreenState);
        }, []);
    }

    function openStackMatPicker() {
        dispatch(openModal(<StackMatPicker />));
    }

    // Timer logic copied from TimerTab.tsx
    // REMOVED: Manuel entry artık her zaman kullanılabilir (smart cube aktifken de)

    function selectTimerType(newTimerType: AllSettings['timer_type']) {
        setSetting('manual_entry', false);
        setSetting('timer_type', newTimerType);
    }

    function toggleManualEntry() {
        if (!manualEntry) {
            setSetting('timer_type', 'keyboard');
        }
        toggleSetting('manual_entry');
    }

    if (!isOpen) {
        return null;
    }

    const timerOptions = [
        {
            label: 'Klavye',
            isActive: timerType === 'keyboard' && !manualEntry,
            onClick: () => selectTimerType('keyboard'),
        },
        {
            label: 'StackMat',
            isActive: timerType === 'stackmat' && !manualEntry,
            onClick: openStackMatPicker,
        },
        {
            label: 'Akıllı Küp',
            isActive: timerType === 'smart' && !manualEntry,
            disabled: cubeType !== '333',
            onClick: () => selectTimerType('smart'),
        },
        {
            label: 'GAN Akıllı Timer',
            isActive: timerType === 'gantimer' && !manualEntry,
            onClick: () => selectTimerType('gantimer'),
        },
        {
            label: 'Manuel Giriş',
            isActive: manualEntry,
            disabled: false, // ✅ Artık hiçbir zaman disabled değil
            onClick: toggleManualEntry,
        },
    ];

    // Disable disallowed types based on room settings
    const finalTimerOptions = timerOptions.map(option => {
        let typeKey = '';
        if (option.label === 'Klavye') typeKey = 'keyboard';
        else if (option.label === 'StackMat') typeKey = 'stackmat';
        else if (option.label === 'Akıllı Küp') typeKey = 'smart';
        else if (option.label === 'GAN Akıllı Timer') typeKey = 'gantimer';
        else if (option.label === 'Manuel Giriş') typeKey = 'manual';

        const isAllowed = !allowedTimerTypes || allowedTimerTypes.includes(typeKey);

        if (!isAllowed) {
            return {
                ...option,
                disabled: true,
                label: (
                    <span className="flex items-center gap-2">
                        {option.label}
                        <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Lock size={10} weight="fill" />
                            İzin Verilmiyor
                        </span>
                    </span>
                ) as any
            };
        }
        return option;
    });

    // Inspection availability based on timer type
    // Stackmat: inspection disabled (timer handles it physically)
    // Smart cube: user can toggle (FIX: removed forced inspection)
    // Keyboard/GAN Timer: user can toggle
    const inspectionDisabled = timerType === 'stackmat';

    const extrasOptions = [
        {
            label: 'Tam Ekran',
            isActive: fullScreenMode,
            hidden: !screenfull.isEnabled,
            disabled: false,
            onClick: () => screenfull.toggle(),
        },
        {
            label: 'Odak Modu',
            isActive: focusMode,
            hidden: false,
            disabled: false,
            onClick: () => toggleSetting('focus_mode'),
        },
        {
            label: 'İnceleme Süresi',
            isActive: inspection,
            hidden: false,
            disabled: inspectionDisabled,
            onClick: () => {
                if (!inspectionDisabled) {
                    toggleSetting('inspection');
                }
            },
        },
    ];

    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }

    return createPortal(
        <div className="room-settings-modal__backdrop" onClick={handleBackdropClick}>
            <div className="room-settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="room-settings-modal__header">
                    <div className="room-settings-modal__tabs">
                        <button
                            type="button"
                            className={`room-settings-modal__tab ${activeTab === 'timer' ? 'room-settings-modal__tab--active' : ''}`}
                            onClick={() => setActiveTab('timer')}
                        >
                            Timer
                        </button>
                        <button
                            type="button"
                            className={`room-settings-modal__tab ${activeTab === 'extras' ? 'room-settings-modal__tab--active' : ''}`}
                            onClick={() => setActiveTab('extras')}
                        >
                            Ek Ayarlar
                        </button>
                    </div>
                    <button
                        type="button"
                        className="room-settings-modal__close"
                        onClick={onClose}
                        aria-label="Kapat"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="room-settings-modal__content overflow-y-auto max-h-[70vh] px-2">
                    {activeTab === 'timer' && (
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2 mb-4 px-1">
                                <div className="h-2 w-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
                                <p className="text-slate-300 text-sm font-medium">
                                    Timer türünü seçin (sadece bir tane aktif olabilir)
                                </p>
                            </div>
                            {finalTimerOptions.map((option) => (
                                <TimerOption
                                    key={typeof option.label === 'string' ? option.label : 'locked-' + Math.random()}
                                    label={option.label as string}
                                    isActive={option.isActive}
                                    disabled={option.disabled}
                                    onClick={option.onClick}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab === 'extras' && (
                        <div className="room-settings-modal__section">
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center space-x-2 mb-4 px-1">
                                    <div className="h-2 w-2 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"></div>
                                    <p className="text-slate-300 text-sm font-medium">
                                        Hızlı ek özellikleri aktifleştirin
                                    </p>
                                </div>
                                {extrasOptions.map((option) => (
                                    <ExtrasOption
                                        key={option.label}
                                        label={option.label}
                                        isActive={option.isActive}
                                        hidden={option.hidden}
                                        disabled={option.disabled}
                                        onClick={option.onClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
