import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'phosphor-react';
import Button from '../common/button/Button';
import { FriendlyRoomScrambleHistoryEntry } from '../../../shared/friendly_room';

interface ScrambleViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    round: number | null;
    scrambleHistory: FriendlyRoomScrambleHistoryEntry[];
}

export default function ScrambleViewModal({ isOpen, onClose, round, scrambleHistory }: ScrambleViewModalProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setCopied(false);
        }
    }, [isOpen]);

    if (!isOpen || round === null) return null;

    const entry = scrambleHistory.find(s => s.scramble_index === round);
    const scramble = entry?.scramble ?? null;

    const handleCopy = async () => {
        if (!scramble) return;
        try {
            await navigator.clipboard.writeText(scramble);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch (e) {
            // clipboard erisimi reddedilirse sessizce gec
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-background border border-text/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-text/[0.05] bg-module shrink-0">
                    <h3 className="text-lg font-bold text-text">
                        {t('rooms.scrambleModal.title', { round })}
                    </h3>
                    <button onClick={onClose} className="text-text hover:opacity-80 transition-opacity">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {scramble ? (
                        <code className="block w-full bg-module border border-text/[0.1] rounded-lg p-4 font-mono text-sm text-text break-words whitespace-pre-wrap leading-relaxed">
                            {scramble}
                        </code>
                    ) : (
                        <p className="text-sm font-medium text-text">
                            {t('rooms.scrambleModal.notStored')}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-text/[0.05] bg-module shrink-0">
                    {scramble && (
                        <Button onClick={handleCopy} primary className="px-4 py-2 inline-flex items-center gap-2">
                            {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
                            <span>{copied ? t('rooms.scrambleModal.copied') : t('rooms.scrambleModal.copy')}</span>
                        </Button>
                    )}
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text hover:opacity-80 transition-opacity">
                        {t('rooms.scrambleModal.close')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
