import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../common/button/Button';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomData,
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomSocketRoom,
} from '../../../shared/friendly_room';
import CreateRoomModal from './CreateRoomModal';
import RoomCard from './RoomCard';
import { useDispatch } from 'react-redux';
import { openModal } from '../../actions/general';
import { useMe } from '../../util/hooks/useMe';
import PageTitle from '../common/page_title/PageTitle';
import './RoomsList.scss';

export default function RoomsList() {
    const { t } = useTranslation();
    const [rooms, setRooms] = useState<FriendlyRoomData[]>([]);
    const [loading, setLoading] = useState(true);
    const history = useHistory();
    const dispatch = useDispatch();
    const me = useMe();

    const isAdmin = me?.admin === true;

    useEffect(() => {
        const socket = socketClient() as any;

        // Join lobby for updates
        socket.emit('joinRoom', FriendlyRoomSocketRoom.LOBBY);

        // Request rooms list
        socket.emit(FriendlyRoomClientEvent.GET_ROOMS);

        // Listen for rooms list (this handles both initial load and updates)
        socket.on(FriendlyRoomServerEvent.ROOMS_LIST, (roomsList: FriendlyRoomData[]) => {
            setRooms(roomsList);
            setLoading(false);
        });

        // Listen for room created (navigate to new room if I created it)
        socket.on(FriendlyRoomServerEvent.ROOM_CREATED, (room: FriendlyRoomData) => {
            // Navigate to the newly created room
            history.push(`/rooms/${room.id}`);
        });

        // Listen for room deleted
        socket.on(FriendlyRoomServerEvent.ROOM_DELETED, (roomId: string) => {
            setRooms((prev) => prev.filter((r) => r.id !== roomId));
        });

        return () => {
            socket.emit('leaveRoom', FriendlyRoomSocketRoom.LOBBY);
            socket.off(FriendlyRoomServerEvent.ROOMS_LIST);
            socket.off(FriendlyRoomServerEvent.ROOM_CREATED);
            socket.off(FriendlyRoomServerEvent.ROOM_DELETED);
        };
    }, [history]);

    function openCreateRoomModal() {
        dispatch(openModal(<CreateRoomModal />, {
            hideCloseButton: true,
            noPadding: true,
        }));
    }

    function handleJoinRoom(room: FriendlyRoomData) {
        history.push(`/rooms/${room.id}`);
    }

    // Admin functions
    function handleAdminDeleteRoom(roomId: string) {
        const socket = socketClient() as any;
        socket.emit(FriendlyRoomClientEvent.KICK_USER, roomId, 'ADMIN_DELETE_ROOM');
        // Actually delete the room by kicking all users or using a special admin delete
        // For now, we'll use the existing leave mechanism but the backend should handle admin commands
        // We need to add an admin-specific delete that works without being in the room
    }

    const publicRooms = rooms.filter((r) => !r.is_private);
    const privateRooms = rooms.filter((r) => r.is_private);

    return (
        <div className="rooms-list-page">
            <div className="rooms-list-page__container">
                <div className="rooms-list-page__header">
                    <div className="rooms-list-page__title-section">
                        <PageTitle pageName={t('rooms.page_title')} />
                        <p className="rooms-list-page__description">
                            {t('rooms.description')}
                        </p>
                    </div>
                    <Button primary onClick={openCreateRoomModal} className="rooms-list-page__create-btn">
                        {t('rooms.create_room')}
                    </Button>
                </div>

                <div className="rooms-list-page__content">
                    {loading ? (
                        <div className="rooms-list-page__loading">{t('rooms.loading')}</div>
                    ) : (
                        <>
                            {publicRooms.length === 0 && privateRooms.length === 0 ? (
                                <div className="rooms-list-page__empty">
                                    <div className="rooms-list-page__empty-icon">🎮</div>
                                    <h3>{t('rooms.no_rooms')}</h3>
                                    <p>{t('rooms.no_rooms_desc')}</p>
                                    <Button primary onClick={openCreateRoomModal}>
                                        {t('rooms.create_first_room')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="rooms-list-page__scroll-area">
                                    {publicRooms.length > 0 && (
                                        <div className="rooms-list-page__section">
                                            <h3 className="rooms-list-page__section-title">
                                                {t('rooms.public_rooms')}
                                            </h3>
                                            <div className="rooms-list-page__grid">
                                                {publicRooms.map((room) => (
                                                    <RoomCard
                                                        key={room.id}
                                                        room={room}
                                                        onJoin={() => handleJoinRoom(room)}
                                                        isAdmin={isAdmin}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {privateRooms.length > 0 && (
                                        <div className="rooms-list-page__section">
                                            <h3 className="rooms-list-page__section-title">
                                                {t('rooms.private_rooms')}
                                            </h3>
                                            <div className="rooms-list-page__grid">
                                                {privateRooms.map((room) => (
                                                    <RoomCard
                                                        key={room.id}
                                                        room={room}
                                                        onJoin={() => handleJoinRoom(room)}
                                                        isAdmin={isAdmin}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
