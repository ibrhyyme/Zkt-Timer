import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../common/button/Button';
import { DeviceMobile as DeviceMobileIcon } from 'phosphor-react';
import './SessionTakeoverModal.scss';

interface SessionTakeoverModalProps {
    onConfirm: () => void;
}

export default function SessionTakeoverModal({ onConfirm }: SessionTakeoverModalProps) {
    const { t } = useTranslation();

    return (
        <div className="session-takeover-modal">
            <div className="session-takeover-modal__card">
                <div className="session-takeover-modal__icon-wrapper">
                    <DeviceMobileIcon size={32} weight="fill" />
                </div>
                <h2>{t('rooms.session_takeover_title')}</h2>
                <p>{t('rooms.session_takeover_message')}</p>
                <div className="session-takeover-modal__actions">
                    <Button primary onClick={onConfirm} className="session-takeover-modal__btn-confirm">
                        {t('rooms.session_takeover_button')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
