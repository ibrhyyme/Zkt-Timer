import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, Trash } from 'phosphor-react';
import Button from '../common/button/Button';
import { FriendlyRoomScrambleHistoryEntry, FriendlyRoomSolveData } from '../../../shared/friendly_room';
import { convertTimeStringToSeconds, getTimeString } from '../../util/time';

interface EditSolveModalProps {
    isOpen: boolean;
    solve: FriendlyRoomSolveData | null;
    scrambleHistory: FriendlyRoomScrambleHistoryEntry[];
    onClose: () => void;
    onSave: (solveId: string, time: number, plusTwo: boolean, dnf: boolean) => void;
    onDelete: (solveId: string) => void;
}

// Parses what the user typed into raw seconds. Returns null when the value cannot become a
// valid solve time. A DNF is expressed through the toggle, never through the text, so a
// typed "dnf" is rejected here rather than silently sent as the -1 the parser returns.
function parseTimeInput(value: string, dnf: boolean): number | null {
    try {
        const parsed = convertTimeStringToSeconds(value, false);
        if (parsed.dnf) return null;
        if (!Number.isFinite(parsed.timeSeconds)) return null;
        // Server rejects anything outside 0-600 seconds (see submitSolve).
        if (parsed.timeSeconds < 0 || parsed.timeSeconds > 600) return null;
        // A zero time only makes sense on a DNF.
        if (parsed.timeSeconds === 0 && !dnf) return null;
        return parsed.timeSeconds;
    } catch {
        return null;
    }
}

export default function EditSolveModal({
    isOpen,
    solve,
    scrambleHistory,
    onClose,
    onSave,
    onDelete,
}: EditSolveModalProps) {
    const { t } = useTranslation();
    const [timeInput, setTimeInput] = useState('');
    const [dnf, setDnf] = useState(false);
    const [plusTwo, setPlusTwo] = useState(false);

    const solveId = solve?.id;

    // Re-seed the form whenever a different solve is opened. The raw time is shown, not the
    // +2-adjusted one, because the penalty is applied at display time everywhere else.
    useEffect(() => {
        if (!solve) return;
        setTimeInput(getTimeString(solve.time, 2));
        setDnf(solve.dnf);
        setPlusTwo(solve.plus_two);
    }, [solveId, isOpen]);

    const parsedTime = useMemo(() => parseTimeInput(timeInput, dnf), [timeInput, dnf]);

    if (!isOpen || !solve || !solveId) return null;

    const round = solve.scramble_index;
    const scramble = scrambleHistory.find((s) => s.scramble_index === round)?.scramble ?? null;
    const isValid = parsedTime !== null;

    function handleSave() {
        if (parsedTime === null || !solveId) return;
        onSave(solveId, parsedTime, plusTwo, dnf);
        onClose();
    }

    function handleDelete() {
        if (!solveId) return;
        if (!window.confirm(t('rooms.edit_solve.delete_confirm'))) return;
        onDelete(solveId);
        onClose();
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-background border border-text/[0.1] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-text/[0.05] bg-module shrink-0">
                    <h3 className="text-lg font-bold text-text">{t('rooms.edit_solve.title')}</h3>
                    <button onClick={onClose} className="text-text hover:opacity-80 transition-opacity">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-text">
                            {t('rooms.scrambleModal.title', { round })}
                        </span>
                        {scramble ? (
                            <code className="block w-full bg-module border border-text/[0.1] rounded-lg p-3 font-mono text-sm text-text break-words whitespace-pre-wrap leading-relaxed">
                                {scramble}
                            </code>
                        ) : (
                            <p className="text-sm font-medium text-text">{t('rooms.scrambleModal.notStored')}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="room-edit-solve-time" className="text-sm font-bold text-text">
                            {t('rooms.edit_solve.time_label')}
                        </label>
                        <input
                            id="room-edit-solve-time"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck="false"
                            className={`w-full px-4 py-3 text-2xl font-mono text-center rounded-lg bg-module border-2 ${
                                isValid ? 'border-text/[0.2] focus:border-blue-500' : 'border-red-500 focus:border-red-400'
                            } text-text outline-none transition-colors appearance-none`}
                            value={timeInput}
                            onChange={(e) => setTimeInput(e.target.value)}
                        />
                        {!isValid && (
                            <span className="text-sm font-bold text-red-500">{t('rooms.edit_solve.invalid_time')}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setPlusTwo((v) => !v)}
                            className={`flex-1 py-3 rounded-lg font-bold text-base border-2 transition-colors ${
                                plusTwo
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'bg-module border-text/[0.2] text-text hover:border-text/[0.4]'
                            }`}
                        >
                            +2
                        </button>
                        <button
                            type="button"
                            onClick={() => setDnf((v) => !v)}
                            className={`flex-1 py-3 rounded-lg font-bold text-base border-2 transition-colors ${
                                dnf
                                    ? 'bg-rose-500 border-rose-500 text-white'
                                    : 'bg-module border-text/[0.2] text-text hover:border-text/[0.4]'
                            }`}
                        >
                            DNF
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-text/[0.05] bg-module shrink-0">
                    <button
                        onClick={handleDelete}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-rose-500 hover:opacity-80 transition-opacity"
                    >
                        <Trash size={16} weight="bold" />
                        <span>{t('rooms.edit_solve.delete')}</span>
                    </button>
                    <Button onClick={handleSave} primary disabled={!isValid} className="px-5 py-2">
                        {t('rooms.edit_solve.done')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
