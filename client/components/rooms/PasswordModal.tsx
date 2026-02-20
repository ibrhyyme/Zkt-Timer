import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../common/button/Button';
import { Lock as LockIcon } from 'phosphor-react';
import './PasswordModal.scss';

interface PasswordModalProps {
    onSubmit: (password: string) => void;
    onCancel: () => void;
}

export default function PasswordModal({ onSubmit, onCancel }: PasswordModalProps) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (password.trim()) {
            onSubmit(password.trim());
        }
    }

    return (
        <div className="password-modal">
            <div className="password-modal__card">
                <div className="password-modal__icon-wrapper">
                    <LockIcon size={32} weight="fill" />
                </div>
                <h2>{t('rooms.protected_room')}</h2>
                <p>{t('rooms.password_required')}</p>
                <form onSubmit={handleSubmit}>
                    <div className="password-modal__input-wrapper">
                        <LockIcon size={20} className="password-modal__input-icon" />
                        <input
                            type="password"
                            className="password-modal__input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('rooms.password_placeholder')}
                            autoFocus
                        />
                    </div>
                    <div className="password-modal__actions">
                        <Button type="button" onClick={onCancel} className="password-modal__btn-cancel">
                            {t('rooms.cancel')}
                        </Button>
                        <Button primary type="submit" disabled={!password.trim()} className="password-modal__btn-submit">
                            {t('rooms.join')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
