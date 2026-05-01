
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, User } from 'phosphor-react';
import {
    FriendlyRoomParticipantData,
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
} from '../../../shared/friendly_room';
import { socketClient } from '../../util/socket/socketio';

interface BannedUser {
    user_id: string;
    username: string;
    banned_at: string;
}

interface ManageUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
    participants: FriendlyRoomParticipantData[];
    onKick: (userId: string) => void;
    onBan: (userId: string) => void;
}

const getSocket = () => socketClient() as any;

export default function ManageUsersModal({ isOpen, onClose, roomId, participants, onKick, onBan }: ManageUsersModalProps) {
    const { t } = useTranslation();
    const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);

    // Modal acildiginda banlilari fetch et + listener bagla; kapaninca cleanup
    useEffect(() => {
        if (!isOpen || !roomId) return;
        const socket = getSocket();

        const handleBannedList = (payload: { room_id: string; banned_users: BannedUser[] }) => {
            if (payload.room_id !== roomId) return;
            setBannedUsers(payload.banned_users || []);
        };
        const handleUserUnbanned = (payload: { room_id: string; user_id: string }) => {
            if (payload.room_id !== roomId) return;
            setBannedUsers(prev => prev.filter(b => b.user_id !== payload.user_id));
        };

        socket.on(FriendlyRoomServerEvent.BANNED_USERS_LIST, handleBannedList);
        socket.on(FriendlyRoomServerEvent.USER_UNBANNED, handleUserUnbanned);

        socket.emit(FriendlyRoomClientEvent.GET_BANNED_USERS, roomId);

        return () => {
            socket.off(FriendlyRoomServerEvent.BANNED_USERS_LIST, handleBannedList);
            socket.off(FriendlyRoomServerEvent.USER_UNBANNED, handleUserUnbanned);
        };
    }, [isOpen, roomId]);

    if (!isOpen) return null;

    const handleUnban = (userId: string) => {
        getSocket().emit(FriendlyRoomClientEvent.UNBAN_USER, roomId, userId);
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-background border border-text/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-text/[0.05] bg-module">
                    <h3 className="text-lg font-bold text-text">{t('rooms.manage_users')}</h3>
                    <button onClick={onClose} className="text-text/50 hover:text-text transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* In Room Section */}
                    <div>
                        <h4 className="text-sm font-bold text-text/40 uppercase tracking-wider mb-4">{t('rooms.in_room')}</h4>
                        <div className="space-y-2">
                            {participants.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-module border border-text/[0.1] rounded-lg group hover:border-text/[0.2] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-button flex items-center justify-center text-text/50">
                                            <User weight="bold" size={20} />
                                        </div>
                                        <span className="font-medium text-text/80">{p.username}</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Competing Checkbox (Visual only for now as requested) */}
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <div className="w-5 h-5 rounded border border-blue-500 bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <X weight="bold" size={12} className="opacity-0 checked:opacity-100" />
                                                {/* Using check icon actually */}
                                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
                                            </div>
                                            <span className="text-sm text-text/70">{t('rooms.competing')}</span>
                                        </label>

                                        <div className="h-4 w-px bg-gray-800 mx-2" />

                                        <button
                                            onClick={() => onKick(p.user_id)}
                                            className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-wider px-2 py-1 hover:bg-red-500/10 rounded transition-colors"
                                        >
                                            {t('rooms.kick')}
                                        </button>
                                        <button
                                            onClick={() => onBan(p.user_id)}
                                            className="text-xs font-bold text-text/40 hover:text-text/60 uppercase tracking-wider px-2 py-1 hover:bg-text/[0.1] rounded transition-colors"
                                        >
                                            {t('rooms.ban')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Banned Section */}
                    <div>
                        <h4 className="text-sm font-bold text-text/40 uppercase tracking-wider mb-4">{t('rooms.banned')}</h4>
                        {bannedUsers.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-text/[0.15] rounded-lg">
                                <span className="text-text/40 text-sm">{t('rooms.no_banned')}</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {bannedUsers.map(b => (
                                    <div key={b.user_id} className="flex items-center justify-between p-3 bg-module border border-text/[0.1] rounded-lg hover:border-text/[0.2] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-button flex items-center justify-center text-text/50">
                                                <User weight="bold" size={20} />
                                            </div>
                                            <span className="font-medium text-text/80">{b.username}</span>
                                        </div>
                                        <button
                                            onClick={() => handleUnban(b.user_id)}
                                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider px-3 py-1.5 hover:bg-emerald-500/10 rounded transition-colors"
                                        >
                                            {t('rooms.unban')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-end px-6 py-4 border-t border-text/[0.05] bg-module">
                    <button onClick={onClose} className="text-sm font-bold text-text/50 hover:text-text transition-colors uppercase tracking-wider">
                        {t('rooms.close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
