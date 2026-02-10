import React, { useEffect, useRef } from 'react';

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
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new notification
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [notifications]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0f1014] border-l border-[#333] overflow-hidden">
            <div className="p-2 border-b border-[#333] bg-[#15161a]">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Log</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                {notifications.length === 0 ? (
                    <div className="text-[10px] text-gray-600 italic text-center mt-4">Henüz aktivite yok</div>
                ) : (
                    notifications.map((notif) => (
                        <div key={notif.id} className="flex gap-2 items-start text-[11px] leading-tight animate-fade-in">
                            <span className="text-gray-600 font-mono shrink-0">
                                {new Date(notif.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`break-words ${notif.type === 'JOIN' ? 'text-green-400' :
                                    notif.type === 'LEAVE' ? 'text-red-400' :
                                        notif.type === 'INFO' ? 'text-blue-400' :
                                            'text-gray-400'
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
