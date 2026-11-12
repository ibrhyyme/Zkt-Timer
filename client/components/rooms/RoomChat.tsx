import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gif } from 'phosphor-react';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomChatMessage,
    FriendlyRoomGifBlocked,
} from '../../../shared/friendly_room';
import { useMe } from '../../util/hooks/useMe';
import Switch from '../common/switch/Switch';
import GifPicker from '../common/gif/GifPicker';
import GifMedia from '../common/gif/GifMedia';
import { GifItem, gifWaitMinutes, isGifSearchAvailable } from '../../lib/klipy';
import { GIF_PROVIDER_KLIPY } from '../../../shared/gif';
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
    /** The room's switch. Off hides the GIF button and collapses GIFs already sent. */
    gifsEnabled?: boolean;
    /** Owner, moderator or site admin: sees the switch in the chat header. */
    canManageGifs?: boolean;
    onSetGifsEnabled?: (enabled: boolean) => void;
}

type ChatEntry =
    | { kind: 'message'; at: number; message: FriendlyRoomChatMessage }
    | { kind: 'system'; at: number; line: RoomChatSystemLine };

export default function RoomChat({
    roomId,
    onMessage,
    systemLines,
    gifsEnabled = true,
    canManageGifs = false,
    onSetGifsEnabled,
}: RoomChatProps) {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<FriendlyRoomChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [gifOpen, setGifOpen] = useState(false);
    // After mount only: the key is a client build define, unknown during SSR.
    const [gifAvailable, setGifAvailable] = useState(false);
    // When the server put this sender on a GIF cooldown (epoch ms), so the button can
    // say how long is left instead of failing silently on every tap.
    const [gifBlockedUntil, setGifBlockedUntil] = useState(0);
    const [, setTick] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const me = useMe();

    useEffect(() => setGifAvailable(isGifSearchAvailable()), []);

    // A manager switching GIFs off closes a picker that is open at that moment.
    useEffect(() => {
        if (!gifsEnabled) setGifOpen(false);
    }, [gifsEnabled]);

    useEffect(() => {
        const socket = socketClient() as any;
        const handleBlocked = (data: FriendlyRoomGifBlocked) => {
            if (data?.reason === 'cooldown' && data.retry_after > 0) {
                setGifBlockedUntil(Date.now() + data.retry_after * 1000);
                setGifOpen(false);
            }
        };
        socket.on(FriendlyRoomServerEvent.GIF_BLOCKED, handleBlocked);
        return () => {
            socket.off(FriendlyRoomServerEvent.GIF_BLOCKED, handleBlocked);
        };
    }, []);

    // Re-render once a second while the cooldown runs, and once more when it ends.
    const coolingDown = gifBlockedUntil > Date.now();
    useEffect(() => {
        if (!coolingDown) return;
        const timer = setInterval(() => setTick((n) => n + 1), 1000);
        return () => clearInterval(timer);
    }, [coolingDown]);

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

    // Sent the moment it is tapped; whatever is typed stays for the next line.
    function sendGif(item: GifItem) {
        setGifOpen(false);
        (socketClient() as any).emit(FriendlyRoomClientEvent.SEND_CHAT_GIF, roomId, {
            provider: GIF_PROVIDER_KLIPY,
            id: item.slug,
        });
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="flex flex-col h-full w-full bg-background text-text overflow-hidden relative">
            <div className="shrink-0 flex items-center justify-between gap-2 p-3 border-b border-text/[0.1] bg-background text-xs font-bold uppercase tracking-wider text-text">
                <span>{t('rooms.chat_title')}</span>
                {/* Where a manager sees the spam, so that is where it is switched off:
                    no detour through the room settings while the chat is being buried. */}
                {canManageGifs && gifAvailable && onSetGifsEnabled && (
                    <label className="flex items-center gap-2 cursor-pointer normal-case tracking-normal font-semibold">
                        <span>{t('gif.room_switch')}</span>
                        <Switch small on={gifsEnabled} onChange={(v) => onSetGifsEnabled(v)} />
                    </label>
                )}
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
                                {msg.gif_id && !gifsEnabled ? (
                                    // Switched off: what was already sent collapses too,
                                    // otherwise turning GIFs off would not clean anything up.
                                    <span className="px-1 text-xs italic text-text/[0.72]">{t('gif.hidden_in_room')}</span>
                                ) : msg.gif_id ? (
                                    // No bubble behind a GIF: the picture is the message.
                                    <GifMedia provider={msg.gif_provider} gifId={msg.gif_id} maxWidth={200} />
                                ) : (
                                    <div className={`px-3 py-2 rounded-lg text-sm break-words ${msg.user_id === me?.id
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-button text-text rounded-bl-none'
                                        }`}>
                                        {msg.message}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 p-2 border-t border-text/[0.1] bg-background relative" data-climate-protect>
                {gifOpen && <GifPicker onPick={sendGif} onClose={() => setGifOpen(false)} />}
                {coolingDown && gifsEnabled && (
                    <p className="mb-2 px-1 text-xs text-text/[0.72]">
                        {t('gif.cooldown', { minutes: gifWaitMinutes((gifBlockedUntil - Date.now()) / 1000) })}
                    </p>
                )}
                <div className="flex gap-2">
                    {gifAvailable && gifsEnabled && (
                        <button
                            type="button"
                            className="shrink-0 flex items-center justify-center w-10 rounded bg-text/[0.08] hover:bg-text/[0.12] disabled:cursor-not-allowed text-text text-lg transition-colors"
                            title={t('gif.button')}
                            aria-label={t('gif.button')}
                            disabled={coolingDown}
                            onClick={() => setGifOpen(!gifOpen)}
                        >
                            <Gif weight="bold" />
                        </button>
                    )}
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
