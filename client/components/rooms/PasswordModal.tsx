import React, { useState } from 'react';
import Button from '../common/button/Button';
import { Lock as LockIcon } from 'phosphor-react';
import './PasswordModal.scss';

interface PasswordModalProps {
    onSubmit: (password: string) => void;
    onCancel: () => void;
}

export default function PasswordModal({ onSubmit, onCancel }: PasswordModalProps) {
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
                <h2>Şifreli Oda</h2>
                <p>Bu oda korumalıdır. Katılmak için lütfen giriş şifresini yazın.</p>
                <form onSubmit={handleSubmit}>
                    <div className="password-modal__input-wrapper">
                        <LockIcon size={20} className="password-modal__input-icon" />
                        <input
                            type="password"
                            className="password-modal__input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Şifre..."
                            autoFocus
                        />
                    </div>
                    <div className="password-modal__actions">
                        <Button type="button" onClick={onCancel} className="password-modal__btn-cancel">
                            İptal
                        </Button>
                        <Button primary type="submit" disabled={!password.trim()} className="password-modal__btn-submit">
                            Katıl
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
