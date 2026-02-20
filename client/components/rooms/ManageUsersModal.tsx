
import React from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, User, ShieldSlash, Prohibit } from 'phosphor-react';
import { FriendlyRoomParticipantData } from '../../../shared/friendly_room';

interface ManageUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: FriendlyRoomParticipantData[];
    onKick: (userId: string) => void;
    onBan: (userId: string) => void;
}

export default function ManageUsersModal({ isOpen, onClose, participants, onKick, onBan }: ManageUsersModalProps) {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-[#15161A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1b1f]">
                    <h3 className="text-lg font-bold text-white">{t('rooms.manage_users')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* In Room Section */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('rooms.in_room')}</h4>
                        <div className="space-y-2">
                            {participants.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-[#0a0b0e] border border-gray-800 rounded-lg group hover:border-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400">
                                            <User weight="bold" size={20} />
                                        </div>
                                        <span className="font-medium text-gray-200">{p.username}</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Competing Checkbox (Visual only for now as requested) */}
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <div className="w-5 h-5 rounded border border-blue-500 bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                <X weight="bold" size={12} className="opacity-0 checked:opacity-100" />
                                                {/* Using check icon actually */}
                                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z" /></svg>
                                            </div>
                                            <span className="text-sm text-gray-300">{t('rooms.competing')}</span>
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
                                            className="text-xs font-bold text-gray-500 hover:text-gray-400 uppercase tracking-wider px-2 py-1 hover:bg-gray-800 rounded transition-colors"
                                        >
                                            {t('rooms.ban')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Not In Room Section (Placeholder) */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('rooms.not_in_room')}</h4>
                        <div className="p-8 text-center border border-dashed border-gray-800 rounded-lg">
                            <span className="text-gray-600 text-sm">{t('rooms.no_users')}</span>
                        </div>
                    </div>

                    {/* Banned Section (Placeholder) */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">{t('rooms.banned')}</h4>
                        <div className="p-8 text-center border border-dashed border-gray-800 rounded-lg">
                            <span className="text-gray-600 text-sm">{t('rooms.no_banned')}</span>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="shrink-0 flex items-center justify-end px-6 py-4 border-t border-white/5 bg-[#1a1b1f]">
                    <button onClick={onClose} className="text-sm font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider">
                        {t('rooms.close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
