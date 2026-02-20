import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { socketClient } from '../../util/socket/socketio';
import { FriendlyRoomClientEvent, FriendlyRoomServerEvent } from '../../../shared/friendly_room';
import RoomTable from './RoomTable';
import { FriendlyRoomParticipantData } from '../../../shared/friendly_room';
import { X } from 'phosphor-react';

interface ViewRoomStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
    roomName: string;
}

interface AdminRoomData {
    participants: FriendlyRoomParticipantData[];
    scrambleIndex: number;
    userStatuses: { [userId: string]: string };
}

export default function ViewRoomStatsModal({ isOpen, onClose, roomId, roomName }: ViewRoomStatsModalProps) {
    const { t } = useTranslation();
    const [roomData, setRoomData] = useState<AdminRoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setRoomData(null);
            setLoading(true);
            setError(null);
            return;
        }

        const socket = socketClient() as any;

        // Request room data
        socket.emit(FriendlyRoomClientEvent.ADMIN_VIEW_ROOM, roomId);

        // Listen for room data
        const handleRoomData = (data: AdminRoomData) => {
            setRoomData(data);
            setLoading(false);
        };

        const handleError = (errorMsg: string) => {
            setError(errorMsg);
            setLoading(false);
        };

        socket.on(FriendlyRoomServerEvent.ADMIN_ROOM_DATA, handleRoomData);
        socket.on(FriendlyRoomServerEvent.ERROR, handleError);

        return () => {
            socket.off(FriendlyRoomServerEvent.ADMIN_ROOM_DATA, handleRoomData);
            socket.off(FriendlyRoomServerEvent.ERROR, handleError);
        };
    }, [isOpen, roomId]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-6xl bg-[#15161A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1b1f]">
                    <h3 className="text-lg font-bold text-white">{roomName} - {t('rooms.statistics')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6 min-h-[400px] flex flex-col">
                    {loading && (
                        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                            {t('rooms.loading_stats')}
                        </div>
                    )}

                    {error && (
                        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {roomData && !loading && !error && (
                        <RoomTable
                            participants={roomData.participants}
                            scrambleIndex={roomData.scrambleIndex}
                            userStatuses={roomData.userStatuses}
                        />
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
