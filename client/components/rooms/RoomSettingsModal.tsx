import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'phosphor-react';
import { useTranslation } from 'react-i18next';
import TimerTab from '../quick-controls/tabs/TimerTab';
import ExtrasTab from '../quick-controls/tabs/ExtrasTab';
import './RoomSettingsModal.scss';

interface RoomSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    allowedTimerTypes?: string[];
    requireProForSmart?: boolean;
}

export default function RoomSettingsModal({ isOpen, onClose, allowedTimerTypes, requireProForSmart }: RoomSettingsModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'timer' | 'extras'>('timer');

    if (!isOpen) {
        return null;
    }

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
                            {t('room_settings.extras')}
                        </button>
                    </div>
                    <button
                        type="button"
                        className="room-settings-modal__close"
                        onClick={onClose}
                        aria-label={t('room_settings.close')}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="room-settings-modal__content overflow-y-auto max-h-[70vh] px-2">
                    {activeTab === 'timer' && <TimerTab allowedTimerTypes={allowedTimerTypes} requireProForSmart={requireProForSmart} />}
                    {activeTab === 'extras' && <ExtrasTab />}
                </div>
            </div>
        </div>,
        document.body
    );
}
