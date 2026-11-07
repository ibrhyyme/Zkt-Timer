import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomChatMessage,
} from '../../../shared/friendly_room';
import { useMe } from '../../util/hooks/useMe';
import './RoomChat.scss';

/** A line the room writes itself (Klima Kavgası), shown between the messages by time. */
export interface RoomChatSystemLine {
    id: string;
    at: number;
    text: string;
}

interface RoomChatProps {
    roomId: string;
    /**
     * Called for every message that arrives while this component is mounted. The room
     * uses it to count unread messages for the mobile tab badge — the chat pane is only
     * hidden with CSS there, never unmounted, so listening once here is enough and the
     * room does not need a competing socket listener of its own.
     */
    onMessage?: (message: FriendlyRoomChatMessage) => void;
    systemLines?: RoomChatSystemLine[];
}

type ChatEntry =
    | { kind: 'message'; at: number; message: FriendlyRoomChatMessage }
    | { kind: 'system'; at: number; line: RoomChatSystemLine };

export default function RoomChat({ roomId, onMessage, systemLines }: RoomChatProps) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<FriendlyRoomChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const me = useMe();

    // Kept in a ref so the socket listener below can stay mounted once, without going
    // stale on a parent that re-renders with a new callback identity.
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const socket = socketClient() as any;

        const handleChatMessage = (message: FriendlyRoomChatMessage) => {
            setMessages((prev) => [...prev, message]);
            onMessageRef.current?.(message);
        };

        socket.on(FriendlyRoomServerEvent.CHAT_MESSAGE, handleChatMessage);

        return () => {
            // Pass the handler: the bare `off(event)` form removes EVERY listener for
            // this event, including any other component's.
            socket.off(FriendlyRoomServerEvent.CHAT_MESSAGE, handleChatMessage);
        };
    }, []);

    // Messages and system lines in one timeline. Server messages carry the server's clock and
    // system lines the client's; both are only ever compared for order within this room.
    const entries = useMemo<ChatEntry[]>(() => {
        const list: ChatEntry[] = messages.map((message) => ({
            kind: 'message',
            at: Date.parse(message.created_at) || 0,
            message,
        }));
        for (const line of systemLines ?? []) list.push({ kind: 'system', at: line.at, line });
        return list.sort((a, b) => a.at - b.at);
    }, [messages, systemLines]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [entries.length]);

    function handleSend() {
        if (!inputValue.trim()) return;

        (socketClient() as any).emit(FriendlyRoomClientEvent.SEND_CHAT, roomId, inputValue.trim());
        setInputValue('');
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="flex flex-col h-full w-full bg-background text-text overflow-hidden relative">
            <div className="shrink-0 p-3 border-b border-text/[0.1] bg-background text-xs font-bold uppercase tracking-wider text-text">
                {t('rooms.chat_title')}
            </div>

            <div data-climate-text className="flex-1 overflow-y-auto w-full p-2 space-y-2 scroll-smooth">
                {entries.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-text text-sm italic">
                        {t('rooms.chat_empty')}
                    </div>
                ) : (
                    entries.map((entry) => {
                        if (entry.kind === 'system') {
                            return (
                                <div key={entry.line.id} className="zt-room-chat__system">
                                    {entry.line.text}
                                </div>
                            );
                        }
                        const msg = entry.message;
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col max-w-[85%] ${msg.user_id === me?.id ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                            >
                                <span className={`text-[10px] mb-0.5 px-1 ${msg.user_id === me?.id ? 'text-blue-400' : 'text-text'}`}>
                                    {msg.username}
                                </span>
                                <div className={`px-3 py-2 rounded-lg text-sm break-words ${msg.user_id === me?.id
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-button text-text rounded-bl-none'
                                    }`}>
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 p-2 border-t border-text/[0.1] bg-background" data-climate-protect>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-module border border-text/[0.1] rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-blue-500 transition-colors"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('rooms.chat_placeholder')}
                        maxLength={500}
                    />
                    <button
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                    >
                        {t('rooms.chat_send')}
                    </button>
                </div>
            </div>
        </div>
    );
}
