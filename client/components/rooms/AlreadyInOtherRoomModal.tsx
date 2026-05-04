import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../common/button/Button';
import { Warning as WarningIcon } from 'phosphor-react';
import './AlreadyInOtherRoomModal.scss';

interface AlreadyInOtherRoomModalProps {
    currentRoomName: string;
    onGoToCurrentRoom: () => void;
    onCancel: () => void;
}

export default function AlreadyInOtherRoomModal({
    currentRoomName,
    onGoToCurrentRoom,
    onCancel,
}: AlreadyInOtherRoomModalProps) {
    const { t } = useTranslation();

    return (
        <div className="already-in-other-room-modal">
            <div className="already-in-other-room-modal__card">
                <div className="already-in-other-room-modal__icon-wrapper">
                    <WarningIcon size={32} weight="fill" />
                </div>
                <h2>{t('rooms.already_in_other_room_title')}</h2>
                <p>{t('rooms.already_in_other_room_message', { roomName: currentRoomName })}</p>
                <div className="already-in-other-room-modal__actions">
                    <Button type="button" onClick={onCancel} className="already-in-other-room-modal__btn-cancel">
                        {t('rooms.cancel')}
                    </Button>
                    <Button primary onClick={onGoToCurrentRoom} className="already-in-other-room-modal__btn-go">
                        {t('rooms.go_to_current_room')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
