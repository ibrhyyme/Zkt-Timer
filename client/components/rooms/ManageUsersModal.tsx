
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { User, Crown, ShieldCheck } from 'phosphor-react';
import {
    FriendlyRoomParticipantData,
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
} from '../../../shared/friendly_room';
import {
    FriendlyRoomRole,
    getFriendlyRoomRole,
    canModerateRole,
    canAssignRoles,
} from '../../../shared/friendly_room/roles';
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
    ownerId: string;
    viewerId: string;
    viewerRole: FriendlyRoomRole;
    // Site admin acting on a room from the lobby: they are not a participant, so they
    // sit outside the room hierarchy entirely (the server grants the same bypass).
    isSiteAdmin?: boolean;
    onKick: (userId: string) => void;
    onBan: (userId: string) => void;
    onSetModerator: (userId: string, isModerator: boolean) => void;
    // Omitted for site admins — handing a room to someone else is the owner's call only.
    onTransferOwnership?: (userId: string) => void;
}

const getSocket = () => socketClient() as any;

export default function ManageUsersModal({
    isOpen,
    onClose,
    roomId,
    participants,
    ownerId,
    viewerId,
    viewerRole,
    isSiteAdmin = false,
    onKick,
    onBan,
    onSetModerator,
    onTransferOwnership,
}: ManageUsersModalProps) {
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

    const handleTransfer = (userId: string, username: string) => {
        // Irreversible for the current owner: afterwards the target outranks them and can
        // kick them out of their own room, so it always goes through a confirmation.
        if (!window.confirm(t('rooms.transfer_ownership_confirm', { name: username }))) return;
        onTransferOwnership?.(userId);
    };

    const canAssign = isSiteAdmin || canAssignRoles(viewerRole);
    // The server refuses ownership transfer for anyone but the current owner, so the
    // button must not appear for site admins either.
    const canTransfer = canAssignRoles(viewerRole) && !!onTransferOwnership;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-background border border-text/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="shrink-0 flex items-center px-6 py-4 border-b border-text/[0.05] bg-module">
                    <h3 className="text-lg font-bold text-text">{t('rooms.manage_users')}</h3>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* In Room Section */}
                    <div>
                        <h4 className="text-sm font-bold text-text uppercase tracking-wider mb-4">{t('rooms.in_room')}</h4>
                        <div className="space-y-2">
                            {participants.map(p => {
                                const targetRole = getFriendlyRoomRole(ownerId, p.user_id, p.is_moderator);
                                const isSelf = p.user_id === viewerId;
                                const canModerateThisUser = !isSelf && (isSiteAdmin || canModerateRole(viewerRole, targetRole));
                                // Only the owner assigns roles, and never to their own row.
                                const canChangeRole = canAssign && !isSelf && targetRole !== FriendlyRoomRole.OWNER;

                                return (
                                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 bg-module border border-text/[0.1] rounded-lg hover:border-text/[0.2] transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 shrink-0 rounded-full bg-button flex items-center justify-center text-text">
                                                <User weight="bold" size={20} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                <span className="font-medium text-text truncate">{p.username}</span>
                                                {isSelf && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text bg-text/[0.1] px-1.5 py-0.5 rounded-sm">
                                                        {t('rooms.you')}
                                                    </span>
                                                )}
                                                {targetRole === FriendlyRoomRole.OWNER && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-400/15 px-1.5 py-0.5 rounded-sm">
                                                        <Crown size={11} weight="fill" />
                                                        {t('rooms.role_owner')}
                                                    </span>
                                                )}
                                                {targetRole === FriendlyRoomRole.MODERATOR && (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-400/15 px-1.5 py-0.5 rounded-sm">
                                                        <ShieldCheck size={11} weight="fill" />
                                                        {t('rooms.role_moderator')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {canChangeRole && (
                                                <button
                                                    onClick={() => onSetModerator(p.user_id, targetRole !== FriendlyRoomRole.MODERATOR)}
                                                    className="text-xs font-bold text-sky-400 hover:text-sky-300 uppercase tracking-wider px-2 py-1 hover:bg-sky-500/10 rounded transition-colors"
                                                >
                                                    {targetRole === FriendlyRoomRole.MODERATOR
                                                        ? t('rooms.remove_moderator')
                                                        : t('rooms.make_moderator')}
                                                </button>
                                            )}
                                            {canTransfer && !isSelf && targetRole !== FriendlyRoomRole.OWNER && (
                                                <button
                                                    onClick={() => handleTransfer(p.user_id, p.username)}
                                                    className="text-xs font-bold text-orange-400 hover:text-orange-300 uppercase tracking-wider px-2 py-1 hover:bg-orange-500/10 rounded transition-colors"
                                                >
                                                    {t('rooms.transfer_ownership')}
                                                </button>
                                            )}
                                            {canModerateThisUser && (
                                                <>
                                                    <div className="h-4 w-px bg-text/[0.15]" />
                                                    <button
                                                        onClick={() => onKick(p.user_id)}
                                                        className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-wider px-2 py-1 hover:bg-red-500/10 rounded transition-colors"
                                                    >
                                                        {t('rooms.kick')}
                                                    </button>
                                                    <button
                                                        onClick={() => onBan(p.user_id)}
                                                        className="text-xs font-bold text-text hover:text-text uppercase tracking-wider px-2 py-1 hover:bg-text/[0.1] rounded transition-colors"
                                                    >
                                                        {t('rooms.ban')}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Banned Section */}
                    <div>
                        <h4 className="text-sm font-bold text-text uppercase tracking-wider mb-4">{t('rooms.banned')}</h4>
                        {bannedUsers.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-text/[0.15] rounded-lg">
                                <span className="text-text text-sm">{t('rooms.no_banned')}</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {bannedUsers.map(b => (
                                    <div key={b.user_id} className="flex items-center justify-between p-3 bg-module border border-text/[0.1] rounded-lg hover:border-text/[0.2] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-button flex items-center justify-center text-text">
                                                <User weight="bold" size={20} />
                                            </div>
                                            <span className="font-medium text-text">{b.username}</span>
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
                    <button onClick={onClose} className="text-sm font-bold text-text hover:text-text transition-colors uppercase tracking-wider">
                        {t('rooms.done')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
