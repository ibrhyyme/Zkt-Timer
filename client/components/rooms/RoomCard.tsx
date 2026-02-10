import React, { useState } from 'react';
import { FriendlyRoomData, FriendlyRoomClientEvent } from '../../../shared/friendly_room';
import Button from '../common/button/Button';
import { Users, Lock, LockOpen, Cube, DotsThreeVertical, Trash, PencilSimple, UserList, Eye } from 'phosphor-react';
import { socketClient } from '../../util/socket/socketio';
import EditRoomModal from './EditRoomModal';
import ManageUsersModal from './ManageUsersModal';
import ViewRoomStatsModal from './ViewRoomStatsModal';
import './RoomCard.scss';

interface RoomCardProps {
    room: FriendlyRoomData;
    onJoin: () => void;
    isAdmin?: boolean;
}

export default function RoomCard({ room, onJoin, isAdmin = false }: RoomCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
    const [viewStatsModalOpen, setViewStatsModalOpen] = useState(false);

    const participantCount = room.participants.length;
    const isFull = participantCount >= room.max_players;
    const statusText = room.status === 'WAITING' ? 'BEKLİYOR' : 'AKTİF';
    const statusClass = room.status === 'WAITING' ? 'waiting' : 'active';

    const getSocket = () => socketClient() as any;

    const handleAdminDeleteRoom = () => {
        if (window.confirm(`"${room.name}" odasını silmek istediğinizden emin misiniz?`)) {
            getSocket().emit(FriendlyRoomClientEvent.ADMIN_DELETE_ROOM, room.id);
        }
        setMenuOpen(false);
    };

    const handleAdminEditRoom = () => {
        // Close other modals first
        setViewStatsModalOpen(false);
        setManageUsersModalOpen(false);
        setEditModalOpen(true);
        setMenuOpen(false);
    };

    const handleAdminManageUsers = () => {
        // Close other modals first
        setViewStatsModalOpen(false);
        setEditModalOpen(false);
        setManageUsersModalOpen(true);
        setMenuOpen(false);
    };

    const handleAdminViewStats = () => {
        // Close other modals first
        setEditModalOpen(false);
        setManageUsersModalOpen(false);
        setViewStatsModalOpen(true);
        setMenuOpen(false);
    };

    return (
        <div className="room-card">
            <div className="room-card__header">
                <div className="room-card__title">
                    {room.is_private ? (
                        <Lock size={16} weight="bold" />
                    ) : (
                        <LockOpen size={16} weight="bold" />
                    )}
                    <span>{room.name}</span>
                </div>
                <div className={`room-card__status room-card__status--${statusClass}`}>
                    {statusText}
                </div>
            </div>

            <div className="room-card__info">
                <div className="room-card__cube-type">
                    <Cube size={16} />
                    <span>{room.cube_type.toUpperCase()}</span>
                </div>
                <div className="room-card__players">
                    <Users size={16} />
                    <span>
                        {participantCount} / {room.max_players}
                    </span>
                </div>
            </div>

            <div className="room-card__participants">
                {room.participants.slice(0, 5).map((p) => (
                    <span key={p.id} className="room-card__participant">
                        {p.username}
                    </span>
                ))}
                {room.participants.length > 5 && (
                    <span className="room-card__participant room-card__participant--more">
                        +{room.participants.length - 5}
                    </span>
                )}
            </div>

            <div className="room-card__footer">
                <Button
                    primary={!isFull}
                    disabled={isFull}
                    small
                    onClick={onJoin}
                >
                    {isFull ? 'Dolu' : 'Katıl'}
                </Button>

                {/* Admin Menu */}
                {isAdmin && (
                    <div className="room-card__admin-menu">
                        <button
                            className="room-card__admin-toggle"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            <DotsThreeVertical size={20} weight="bold" />
                        </button>

                        {menuOpen && (
                            <>
                                <div className="room-card__admin-overlay" onClick={() => setMenuOpen(false)} />
                                <div className="room-card__admin-dropdown">
                                    <button onClick={handleAdminViewStats}>
                                        <Eye size={16} />
                                        Odayı Görüntüle
                                    </button>
                                    <button onClick={handleAdminEditRoom}>
                                        <PencilSimple size={16} />
                                        Odayı Düzenle
                                    </button>
                                    <button onClick={handleAdminManageUsers}>
                                        <UserList size={16} />
                                        Kullanıcıları Yönet
                                    </button>
                                    <div className="room-card__admin-divider" />
                                    <button onClick={handleAdminDeleteRoom} className="room-card__admin-danger">
                                        <Trash size={16} />
                                        Odayı Sil
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Admin Modals */}
            {isAdmin && (
                <>
                    <EditRoomModal
                        isOpen={editModalOpen}
                        onClose={() => setEditModalOpen(false)}
                        currentName={room.name}
                        isPrivate={room.is_private}
                        cubeType={room.cube_type}
                        onSubmit={(name, isPrivate, password, _, cubeType) => {
                            getSocket().emit(FriendlyRoomClientEvent.UPDATE_ROOM, room.id, {
                                name,
                                is_private: isPrivate,
                                password,
                                cube_type: cubeType
                            });
                        }}
                    />
                    <ManageUsersModal
                        isOpen={manageUsersModalOpen}
                        onClose={() => setManageUsersModalOpen(false)}
                        participants={room.participants}
                        onKick={(userId) => {
                            getSocket().emit(FriendlyRoomClientEvent.KICK_USER, room.id, userId);
                        }}
                        onBan={(userId) => {
                            getSocket().emit(FriendlyRoomClientEvent.BAN_USER, room.id, userId);
                        }}
                    />
                    <ViewRoomStatsModal
                        isOpen={viewStatsModalOpen}
                        onClose={() => setViewStatsModalOpen(false)}
                        roomId={room.id}
                        roomName={room.name}
                    />
                </>
            )}
        </div>
    );
}
