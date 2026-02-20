import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { socketClient } from '../../util/socket/socketio';
import { FriendlyRoomClientEvent, CreateFriendlyRoomInput } from '../../../shared/friendly_room';
import { FriendlyRoomConst, ALLOWED_CUBE_TYPES } from '../../../shared/friendly_room/consts';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import { closeModal } from '../../actions/general';
import { Cube, Users, Lock, LockOpen, Sparkle, GameController, X } from 'phosphor-react';
import './CreateRoomModal.scss';
import { useTranslation } from 'react-i18next';

// Helper to get socket with any cast
const getSocket = () => socketClient() as any;

interface CreateRoomFormProps {
    onClose?: () => void;
}

function CreateRoomForm({ onClose }: CreateRoomFormProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const [name, setName] = useState('');
    const [cubeType, setCubeType] = useState('333');
    const [maxPlayers, setMaxPlayers] = useState(FriendlyRoomConst.DEFAULT_MAX_PLAYERS);
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');
    const [creating, setCreating] = useState(false);

    function handleCreate() {
        if (!name.trim()) return;

        setCreating(true);

        const input: CreateFriendlyRoomInput = {
            name: name.trim(),
            cube_type: cubeType,
            max_players: maxPlayers,
            is_private: isPrivate,
            password: isPrivate ? password.trim() : undefined,
        };

        getSocket().emit(FriendlyRoomClientEvent.CREATE_ROOM, input);
        dispatch(closeModal());
    }

    function handleClose() {
        dispatch(closeModal());
        onClose?.();
    }

    return (
        <div className="create-room-modal">
            {/* Decorative Background Elements */}
            <div className="create-room-modal__bg-orb create-room-modal__bg-orb--1" />
            <div className="create-room-modal__bg-orb create-room-modal__bg-orb--2" />
            <div className="create-room-modal__bg-orb create-room-modal__bg-orb--3" />

            {/* Header */}
            <div className="create-room-modal__header">
                <div className="create-room-modal__header-content">
                    <div className="create-room-modal__icon-wrapper">
                        <GameController weight="fill" size={28} />
                    </div>
                    <div>
                        <h2 className="create-room-modal__title">{t('create_room.title')}</h2>
                        <p className="create-room-modal__subtitle">{t('create_room.subtitle')}</p>
                    </div>
                </div>
                <button className="create-room-modal__close" onClick={handleClose}>
                    <X weight="bold" size={20} />
                </button>
            </div>

            {/* Form Content */}
            <div className="create-room-modal__content">
                {/* Room Name Input */}
                <div className="create-room-modal__field">
                    <label className="create-room-modal__label">
                        <Sparkle weight="fill" size={14} />
                        {t('create_room.room_name')}
                    </label>
                    <div className="create-room-modal__input-wrapper">
                        <input
                            type="text"
                            className="create-room-modal__input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('create_room.room_name_placeholder')}
                            maxLength={FriendlyRoomConst.MAX_ROOM_NAME_LENGTH}
                        />
                        <span className="create-room-modal__input-count">
                            {name.length}/{FriendlyRoomConst.MAX_ROOM_NAME_LENGTH}
                        </span>
                    </div>
                </div>

                {/* Cube Type and Max Players Row */}
                <div className="create-room-modal__row">
                    <div className="create-room-modal__field">
                        <label className="create-room-modal__label">
                            <Cube weight="fill" size={14} />
                            {t('create_room.cube_type')}
                        </label>
                        <div className="create-room-modal__select-wrapper">
                            <select
                                className="create-room-modal__select"
                                value={cubeType}
                                onChange={(e) => setCubeType(e.target.value)}
                            >
                                {ALLOWED_CUBE_TYPES.map((ct) => {
                                    const info = getCubeTypeInfoById(ct);
                                    return (
                                        <option key={ct} value={ct}>
                                            {info ? info.name : ct.toUpperCase()}
                                        </option>
                                    );
                                })}
                            </select>
                            <Cube className="create-room-modal__select-icon" weight="fill" size={18} />
                        </div>
                    </div>

                    <div className="create-room-modal__field">
                        <label className="create-room-modal__label">
                            <Users weight="fill" size={14} />
                            {t('create_room.max_players')}
                        </label>
                        <div className="create-room-modal__select-wrapper">
                            <select
                                className="create-room-modal__select"
                                value={maxPlayers}
                                onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                            >
                                {Array.from({ length: FriendlyRoomConst.MAX_PLAYERS - FriendlyRoomConst.MIN_PLAYERS + 1 }, (_, i) => i + FriendlyRoomConst.MIN_PLAYERS).map((num) => (
                                    <option key={num} value={num}>
                                        {num} {t('create_room.players_suffix')}
                                    </option>
                                ))}
                            </select>
                            <Users className="create-room-modal__select-icon" weight="fill" size={18} />
                        </div>
                    </div>
                </div>

                {/* Privacy Toggle */}
                <div className="create-room-modal__privacy-section">
                    <button
                        className={`create-room-modal__privacy-toggle ${isPrivate ? 'create-room-modal__privacy-toggle--active' : ''}`}
                        onClick={() => setIsPrivate(!isPrivate)}
                        type="button"
                    >
                        <div className="create-room-modal__privacy-icon">
                            {isPrivate ? <Lock weight="fill" size={24} /> : <LockOpen weight="fill" size={24} />}
                        </div>
                        <div className="create-room-modal__privacy-text">
                            <span className="create-room-modal__privacy-title">
                                {isPrivate ? t('create_room.private_room') : t('create_room.public_room')}
                            </span>
                            <span className="create-room-modal__privacy-desc">
                                {isPrivate ? t('create_room.private_desc') : t('create_room.public_desc')}
                            </span>
                        </div>
                        <div className={`create-room-modal__privacy-switch ${isPrivate ? 'create-room-modal__privacy-switch--on' : ''}`}>
                            <div className="create-room-modal__privacy-switch-knob" />
                        </div>
                    </button>
                </div>

                {/* Password Field (Animated) */}
                <div className={`create-room-modal__password-section ${isPrivate ? 'create-room-modal__password-section--visible' : ''}`}>
                    <div className="create-room-modal__field">
                        <label className="create-room-modal__label">
                            <Lock weight="fill" size={14} />
                            {t('create_room.room_password')}
                        </label>
                        <div className="create-room-modal__input-wrapper">
                            <input
                                type="password"
                                className="create-room-modal__input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('create_room.password_placeholder')}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="create-room-modal__footer">
                <button className="create-room-modal__btn create-room-modal__btn--secondary" onClick={handleClose}>
                    {t('create_room.cancel')}
                </button>
                <button
                    className={`create-room-modal__btn create-room-modal__btn--primary ${creating ? 'create-room-modal__btn--loading' : ''}`}
                    disabled={!name.trim() || creating || (isPrivate && !password)}
                    onClick={handleCreate}
                >
                    {creating ? (
                        <>
                            <span className="create-room-modal__btn-spinner" />
                            {t('create_room.creating')}
                        </>
                    ) : (
                        <>
                            <Sparkle weight="fill" size={18} />
                            {t('create_room.create_button')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

export default function CreateRoomModal() {
    return <CreateRoomForm />;
}
