
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, Lock, Check, Cube } from 'phosphor-react';
import Button from '../common/button/Button';
import { ALLOWED_CUBE_TYPES } from '../../../shared/friendly_room/consts';
import { getCubeTypeInfoById } from '../../util/cubes/util';



interface EditRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    isPrivate: boolean;
    currentAllowedTypes?: string[];
    cubeType?: string;
    onSubmit: (newName: string, isPrivate: boolean, newPassword?: string, allowedTimerTypes?: string[], cubeType?: string) => void;
}

export default function EditRoomModal({ isOpen, onClose, currentName, isPrivate, currentAllowedTypes, cubeType, onSubmit }: EditRoomModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(currentName);
    const [selectedCubeType, setSelectedCubeType] = useState(cubeType || '333');
    const [privateRoom, setPrivateRoom] = useState(isPrivate);
    const [password, setPassword] = useState('');

    // Default all allowed if undefined
    const allTypes = ['keyboard', 'stackmat', 'gantimer', 'smart', 'manual'];
    const [allowedTypes, setAllowedTypes] = useState<string[]>(
        currentAllowedTypes && currentAllowedTypes.length > 0 ? currentAllowedTypes : allTypes
    );

    const toggleType = (type: string) => {
        if (allowedTypes.includes(type)) {
            // Prevent deselecting all types (must have at least one)
            if (allowedTypes.length > 1) {
                setAllowedTypes(allowedTypes.filter(t => t !== type));
            }
        } else {
            setAllowedTypes([...allowedTypes, type]);
        }
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'keyboard': return t('rooms.keyboard');
            case 'stackmat': return 'StackMat';
            case 'gantimer': return 'GAN Timer';
            case 'smart': return t('rooms.smart_cube');
            case 'manual': return t('rooms.manual_entry');
            default: return type;
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-[#15161A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1b1f] shrink-0">
                    <h3 className="text-lg font-bold text-white">{t('rooms.edit_room')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Room Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{t('rooms.room_name')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#0a0b0e] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder={t('rooms.room_name_placeholder')}
                        />
                    </div>



                    {/* Cube Type Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{t('rooms.cube_type')}</label>
                        <div className="relative">
                            <select
                                value={selectedCubeType}
                                onChange={(e) => setSelectedCubeType(e.target.value)}
                                className="w-full bg-[#0a0b0e] border border-gray-800 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                {ALLOWED_CUBE_TYPES.map((ct) => {
                                    const info = getCubeTypeInfoById(ct);
                                    return (
                                        <option key={ct} value={ct}>
                                            {info ? info.name : ct.toUpperCase()}
                                        </option>
                                    );
                                })}
                            </select>
                            <Cube className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                        </div>
                    </div>

                    {/* Private Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPrivateRoom(!privateRoom)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${privateRoom ? 'bg-blue-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${privateRoom ? 'left-7' : 'left-1'}`} />
                        </button>
                        <span className="text-sm font-medium text-gray-300">{t('rooms.private_room_q')}</span>
                    </div>

                    {/* Password Input */}
                    {privateRoom && (
                        <div className="space-y-2 animate-fadeIn">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{t('rooms.new_password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#0a0b0e] border border-gray-800 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder={t('rooms.new_password_placeholder')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Allowed Timer Types */}
                    <div className="space-y-3 pt-2 border-t border-gray-800">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">{t('rooms.allowed_timer_types')}</label>
                        <div className="grid grid-cols-1 gap-2">
                            {allTypes.map(type => (
                                <div
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${allowedTypes.includes(type)
                                        ? 'bg-blue-500/10 border-blue-500/50'
                                        : 'bg-[#0a0b0e] border-gray-800 hover:border-gray-700'
                                        }`}
                                >
                                    <span className={`text-sm font-medium ${allowedTypes.includes(type) ? 'text-blue-200' : 'text-gray-400'}`}>
                                        {getTypeName(type)}
                                    </span>
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${allowedTypes.includes(type) ? 'bg-blue-500 text-white' : 'bg-gray-800'
                                        }`}>
                                        {allowedTypes.includes(type) && <Check size={12} weight="bold" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-[#1a1b1f] shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                        {t('rooms.cancel')}
                    </button>
                    <Button onClick={() => {
                        if (selectedCubeType !== cubeType) {
                            if (!window.confirm(t('rooms.cube_change_warning'))) {
                                return;
                            }
                        }
                        onSubmit(name, privateRoom, password.trim(), allowedTypes, selectedCubeType);
                        onClose();
                    }} primary className="px-6 py-2">
                        {t('rooms.save')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
