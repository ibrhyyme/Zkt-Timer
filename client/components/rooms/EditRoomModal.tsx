
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, Check } from 'phosphor-react';
import Button from '../common/button/Button';

interface EditRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    isPrivate: boolean;
    onSubmit: (newName: string, isPrivate: boolean, newPassword?: string) => void;
}

export default function EditRoomModal({ isOpen, onClose, currentName, isPrivate, onSubmit }: EditRoomModalProps) {
    const [name, setName] = useState(currentName);
    const [privateRoom, setPrivateRoom] = useState(isPrivate);
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-[#15161A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1b1f]">
                    <h3 className="text-lg font-bold text-white">Odayı Düzenle</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Room Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Oda İsmi</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#0a0b0e] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Oda İsmi Girin..."
                        />
                    </div>

                    {/* Private Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPrivateRoom(!privateRoom)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${privateRoom ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${privateRoom ? 'left-7' : 'left-1'}`} />
                        </button>
                        <span className="text-sm font-medium text-gray-300">Özel Oda?</span>
                    </div>

                    {/* Password Input */}
                    {privateRoom && (
                        <div className="space-y-2 animate-fadeIn">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Yeni Şifre</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#0a0b0e] border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Yeni şifre (Boş bırakılabilir)"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-[#1a1b1f]">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                        İptal
                    </button>
                    <Button onClick={() => {
                        onSubmit(name, privateRoom, password.trim());
                        onClose();
                    }} primary className="px-6 py-2">
                        Kaydet
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
