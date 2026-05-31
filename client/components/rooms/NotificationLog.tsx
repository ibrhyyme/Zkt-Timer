import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface NotificationItem {
    id: string;
    type: string;
    message: string;
    timestamp: number;
}

interface NotificationLogProps {
    notifications: NotificationItem[];
}

export default function NotificationLog({ notifications }: NotificationLogProps) {
    const { t, i18n } = useTranslation();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new notification
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [notifications]);

    return (
        <div className="flex flex-col h-full w-full bg-background border-l border-text/[0.1] overflow-hidden">
            <div className="p-2 border-b border-text/[0.1] bg-module">
                <h3 className="text-xs font-bold text-text uppercase tracking-wider">{t('rooms.log_title')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {notifications.length === 0 ? (
                    <div className="text-[10px] text-text italic text-center mt-4">{t('rooms.log_empty')}</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className="flex gap-2 items-start text-[11px] leading-tight animate-fade-in">
                            <span className="text-text font-mono shrink-0">
                                {new Date(notif.timestamp).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`break-words ${notif.type === 'JOIN' ? 'text-green-400' :
                                    notif.type === 'LEAVE' ? 'text-red-400' :
                                        notif.type === 'INFO' ? 'text-blue-400' :
                                            'text-text'
                                }`}>
                                {notif.message}
                            </span>
                        </div>
                    ))
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
