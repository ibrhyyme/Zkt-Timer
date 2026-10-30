import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Cube, Users, Lock, LockOpen, TextT, Plus } from 'phosphor-react';
import { socketClient } from '../../util/socket/socketio';
import { FriendlyRoomClientEvent, CreateFriendlyRoomInput } from '../../../shared/friendly_room';
import { FriendlyRoomConst, ALLOWED_CUBE_TYPES } from '../../../shared/friendly_room/consts';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import { closeModal } from '../../actions/general';
import FancyDropdown from '../timer/header_control/FancyDropdown';
import Button from '../common/button/Button';
import ModalHeader from '../common/modal/modal_header/ModalHeader';
import block from '../../styles/bem';
import { maxPlayerChoices } from './max_players';
import './CreateRoomModal.scss';

const b = block('create-room-modal');

// Helper to get socket with any cast
const getSocket = () => socketClient() as any;

// Body of the "Create New Room" modal. It opens through openModal, so the frame (close
// button, surface, full screen on a phone) is common/modal/Modal. The header is the
// frame's own ModalHeader, rendered here instead of through the `title` option so the
// form can fill a phone screen and pin its footer band to the bottom edge.
export default function CreateRoomModal() {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const [name, setName] = useState('');
    const [cubeType, setCubeType] = useState('333');
    const [maxPlayers, setMaxPlayers] = useState(FriendlyRoomConst.DEFAULT_MAX_PLAYERS);
    const [isPrivate, setIsPrivate] = useState(false);
    const [password, setPassword] = useState('');

    const canCreate = name.trim().length > 0 && (!isPrivate || password.trim().length > 0);

    function close() {
        dispatch(closeModal());
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canCreate) return;

        const input: CreateFriendlyRoomInput = {
            name: name.trim(),
            cube_type: cubeType,
            max_players: maxPlayers,
            is_private: isPrivate,
            password: isPrivate ? password.trim() : undefined,
        };

        getSocket().emit(FriendlyRoomClientEvent.CREATE_ROOM, input);
        close();
    }

    return (
        <form className={b()} onSubmit={handleSubmit}>
            <ModalHeader title={t('create_room.title')} description={t('create_room.subtitle')} />
            <div className={b('body')}>
                <label className={b('field')}>
                    <span className={b('label')}>
                        <TextT weight="bold" size={14} />
                        {t('create_room.room_name')}
                    </span>
                    <span className={b('input-wrap')}>
                        <input
                            type="text"
                            className={b('input', { counted: true })}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('create_room.room_name_placeholder')}
                            maxLength={FriendlyRoomConst.MAX_ROOM_NAME_LENGTH}
                        />
                        <span className={b('count')}>
                            {name.length}/{FriendlyRoomConst.MAX_ROOM_NAME_LENGTH}
                        </span>
                    </span>
                </label>

                <div className={b('row')}>
                    <div className={b('field')}>
                        <span className={b('label')}>
                            <Cube weight="fill" size={14} />
                            {t('create_room.cube_type')}
                        </span>
                        <FancyDropdown
                            value={cubeType}
                            onValueChange={setCubeType}
                            options={ALLOWED_CUBE_TYPES.map((ct) => {
                                const info = getCubeTypeInfoById(ct);
                                return { value: ct, label: info ? info.name : ct.toUpperCase() };
                            })}
                            triggerLabel={getCubeTypeInfoById(cubeType)?.name || cubeType.toUpperCase()}
                            ariaLabel={t('create_room.cube_type')}
                            noTriggerStyles
                            className={b('select')}
                        />
                    </div>

                    <div className={b('field')}>
                        <span className={b('label')}>
                            <Users weight="fill" size={14} />
                            {t('create_room.max_players')}
                        </span>
                        <FancyDropdown
                            value={String(maxPlayers)}
                            onValueChange={(v) => setMaxPlayers(parseInt(v, 10))}
                            options={maxPlayerChoices(0).map((num) => ({
                                value: String(num),
                                label: `${num} ${t('create_room.players_suffix')}`,
                            }))}
                            triggerLabel={`${maxPlayers} ${t('create_room.players_suffix')}`}
                            ariaLabel={t('create_room.max_players')}
                            noTriggerStyles
                            className={b('select')}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    role="switch"
                    aria-checked={isPrivate}
                    className={b('privacy', { on: isPrivate })}
                    onClick={() => setIsPrivate(!isPrivate)}
                >
                    <span className={b('privacy-icon')}>
                        {isPrivate ? <Lock weight="fill" size={20} /> : <LockOpen weight="fill" size={20} />}
                    </span>
                    <span className={b('privacy-text')}>
                        <span className={b('privacy-title')}>
                            {isPrivate ? t('create_room.private_room') : t('create_room.public_room')}
                        </span>
                        <span className={b('privacy-desc')}>
                            {isPrivate ? t('create_room.private_desc') : t('create_room.public_desc')}
                        </span>
                    </span>
                    <span className={b('switch', { on: isPrivate })}>
                        <span className={b('switch-knob')} />
                    </span>
                </button>

                {/* Always in place, disabled for a public room: a field that appeared on
                    "Private" made the modal grow and jump. */}
                <label className={b('field')}>
                    <span className={b('label')}>
                        <Lock weight="fill" size={14} />
                        {t('create_room.room_password')}
                    </span>
                    <input
                        type="password"
                        className={b('input')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('create_room.password_placeholder')}
                        disabled={!isPrivate}
                        // A new secret for the room, not the account's: keeps the browser
                        // from filling in the saved login password.
                        autoComplete="new-password"
                    />
                </label>
            </div>

            <div className={b('footer')}>
                <Button text={t('create_room.cancel')} onClick={close} />
                <Button
                    primary
                    type="submit"
                    text={t('create_room.create_button')}
                    icon={<Plus weight="bold" />}
                    iconFirst
                    disabled={!canCreate}
                />
            </div>
        </form>
    );
}
