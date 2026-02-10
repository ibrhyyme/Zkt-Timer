import React, { useState, useEffect, useRef } from 'react';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomChatMessage,
} from '../../../shared/friendly_room';
import { useMe } from '../../util/hooks/useMe';

interface RoomChatProps {
    roomId: string;
}

export default function RoomChat({ roomId }: RoomChatProps) {
    const [messages, setMessages] = useState<FriendlyRoomChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const me = useMe();

    useEffect(() => {
        const socket = socketClient() as any;

        socket.on(FriendlyRoomServerEvent.CHAT_MESSAGE, (message: FriendlyRoomChatMessage) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => {
            socket.off(FriendlyRoomServerEvent.CHAT_MESSAGE);
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
        <div className="flex flex-col h-full w-full bg-[#15161A] text-gray-200 overflow-hidden relative">
            <div className="shrink-0 p-3 border-b border-gray-800 bg-[#15161A] text-xs font-bold uppercase tracking-wider text-gray-400">
                Sohbet
            </div>

            <div className="flex-1 overflow-y-auto w-full p-2 space-y-2 scroll-smooth">
                {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-gray-500 text-sm italic">
                        Henüz mesaj yok
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] ${msg.user_id === me?.id ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                        >
                            <span className={`text-[10px] mb-0.5 px-1 ${msg.user_id === me?.id ? 'text-blue-400' : 'text-gray-400'}`}>
                                {msg.username}
                            </span>
                            <div className={`px-3 py-2 rounded-lg text-sm break-words ${msg.user_id === me?.id
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-gray-700/50 text-gray-200 rounded-bl-none'
                                }`}>
                                {msg.message}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 p-2 border-t border-gray-800 bg-[#15161A]">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 bg-[#0a0b0e] border border-gray-700/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Mesaj yaz..."
                        maxLength={500}
                    />
                    <button
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                    >
                        Gönder
                    </button>
                </div>
            </div>
        </div>
    );
}
