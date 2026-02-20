import React, { useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FriendlyRoomParticipantData } from '../../../shared/friendly_room';
import { getTimeString } from '../../util/time';
import { WifiSlash } from 'phosphor-react';

interface RoomTableProps {
    participants: FriendlyRoomParticipantData[];
    scrambleIndex: number;
    userStatuses?: { [userId: string]: string };
    currentUserId?: string;
}

// Timer component for dynamic countdown
const DisconnectTimer = ({ expireTime }: { expireTime: number }) => {
    const [timeLeft, setTimeLeft] = React.useState(Math.max(0, Math.ceil((expireTime - Date.now()) / 1000)));

    React.useEffect(() => {
        const interval = setInterval(() => {
            const diff = Math.ceil((expireTime - Date.now()) / 1000);
            setTimeLeft(Math.max(0, diff));
            if (diff <= 0) clearInterval(interval);
        }, 1000);
        return () => clearInterval(interval);
    }, [expireTime]);

    return <>{timeLeft}sn</>;
};

export default function RoomTable({ participants, scrambleIndex, userStatuses = {}, currentUserId }: RoomTableProps) {
    const { t } = useTranslation();

    // Map status to display text
    const getStatusText = (status: string): string => {
        if (status.startsWith('DISCONNECTED')) return t('room_table.disconnected');
        switch (status) {
            case 'PRIMING':
                return t('room_table.ready');
            case 'INSPECTING':
            case 'INSPECTING_PRIMING':
                return t('room_table.inspecting');
            case 'TIMING':
                return t('room_table.solving');
            case 'SUBMITTING':
            case 'SUBMITTING_DOWN':
                return t('room_table.finished');
            case 'DISCONNECTED':
                return t('room_table.disconnected');
            default:
                return '';
        }
    };

    const tableRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Drag to scroll logic
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    // Generate rows for each scramble index
    const rows = useMemo(() => {
        const rowData = [];
        const maxRound = Math.max(scrambleIndex, ...participants.map(p => p.solves.length > 0 ? Math.max(...p.solves.map(s => s.scramble_index)) : 0));

        // Show in descending order (N... 3, 2, 1) - Latest first
        for (let i = maxRound; i >= 1; i--) {
            rowData.push(i);
        }
        return rowData;
    }, [participants, scrambleIndex]);

    // Find best time for each round (for highlighting)
    const bestTimes = useMemo(() => {
        const bests: { [round: number]: number } = {};
        for (const round of rows) {
            const roundSolves = participants
                .map(p => p.solves.find(s => s.scramble_index === round))
                .filter(s => s && !s.dnf)
                .map(s => s!.plus_two ? s!.time + 2 : s!.time);

            if (roundSolves.length > 0) {
                bests[round] = Math.min(...roundSolves);
            }
        }
        return bests;
    }, [participants, rows]);

    // Calculate stats
    const stats = useMemo(() => {
        return participants.map(p => {
            const solves = p.solves.filter(s => !s.dnf);
            const times = solves.map(s => s.plus_two ? s.time + 2 : s.time);
            const mean = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

            // Calculate wins
            let wins = 0;
            for (let i = 1; i <= scrambleIndex; i++) {
                const roundSolves = participants.map(part => {
                    const s = part.solves.find(sl => sl.scramble_index === i);
                    return { id: part.user_id, solve: s };
                }).filter(item => item.solve && !item.solve.dnf);

                if (roundSolves.length > 0) {
                    roundSolves.sort((a, b) => {
                        const t1 = a.solve!.plus_two ? a.solve!.time + 2 : a.solve!.time;
                        const t2 = b.solve!.plus_two ? b.solve!.time + 2 : b.solve!.time;
                        return t1 - t2;
                    });

                    if (roundSolves[0].id === p.user_id) {
                        wins++;
                    }
                }
            }

            return {
                id: p.user_id,
                mean: mean > 0 ? mean : null,
                meanStr: mean > 0 ? getTimeString(mean) : '-',
                wins
            };
        });
    }, [participants, scrambleIndex]);

    // Find best mean for highlighting
    const bestMean = useMemo(() => {
        const means = stats.filter(s => s.mean !== null).map(s => s.mean!);
        return means.length > 0 ? Math.min(...means) : null;
    }, [stats]);


    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (!tableRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - tableRef.current.offsetLeft;
        scrollLeft.current = tableRef.current.scrollLeft;
        document.body.style.cursor = 'grabbing';
    };

    const handleHeaderMouseLeave = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
    };

    const handleHeaderMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
    };

    const handleHeaderMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !tableRef.current) return;
        e.preventDefault();
        const x = e.pageX - tableRef.current.offsetLeft;
        const walk = (x - startX.current) * 2; // Scroll speed
        tableRef.current.scrollLeft = scrollLeft.current - walk;
    };

    // Scroll to top on user updates logic (preserved)
    useEffect(() => {
        if (tableRef.current) {
            tableRef.current.scrollTop = 0;
        }
    }, [rows.length, scrambleIndex]);

    return (
        <div className="flex flex-col h-full w-full relative group">


            {/* Custom styled scrollbar for Webkit */}
            <style>{`
                .room-table-custom-scroll::-webkit-scrollbar {
                    height: 6px;
                    width: 6px;
                }
                .room-table-custom-scroll::-webkit-scrollbar-track {
                    background: #1a1a1a;
                }
                .room-table-custom-scroll::-webkit-scrollbar-thumb {
                    background: #333;
                    border-radius: 3px;
                }
                .room-table-custom-scroll::-webkit-scrollbar-thumb:hover {
                    background: #444;
                }
            `}</style>

            {/* Main Table Container */}
            <div
                ref={tableRef}

                className="flex-1 w-full overflow-auto bg-[#1E1E1E] text-gray-300 font-sans border border-[#333] text-sm min-h-0 room-table-custom-scroll"
                style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
                <div ref={contentRef} className="flex flex-col min-w-full w-max">

                    {/* Header (Sticky) */}
                    <div
                        className="sticky top-0 z-20 flex w-full bg-[#1E1E1E] border-b border-[#333] text-xs font-bold uppercase tracking-wider text-gray-400 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.3)] cursor-grab active:cursor-grabbing select-none"
                        onMouseDown={handleHeaderMouseDown}
                        onMouseLeave={handleHeaderMouseLeave}
                        onMouseUp={handleHeaderMouseUp}
                        onMouseMove={handleHeaderMouseMove}
                    >
                        <div className="w-12 shrink-0 sticky left-0 z-30 flex items-center justify-center py-3 bg-[#1E1E1E] border-r border-[#333] shadow-sm">
                            #
                        </div>
                        {participants.map(p => {
                            const isMe = p.user_id === currentUserId;
                            return (
                                <div key={p.id} className={`flex-1 min-w-[100px] flex items-center justify-center py-3 px-2 border-r border-[#333] last:border-0 truncate ${isMe ? 'text-blue-200 bg-white/[0.03]' : 'text-gray-400'}`}>
                                    {p.username}
                                </div>
                            );
                        })}
                    </div>

                    {/* Stats Summary Rows */}
                    <div className="flex w-full bg-[#252525] border-b border-[#333] font-mono text-gray-300">

                        <div className="w-12 shrink-0 sticky left-0 z-10 flex items-center justify-center py-2 bg-[#252525] border-r border-[#333] text-[10px] font-sans text-gray-500 uppercase">
                            avg
                        </div>
                        {participants.map(p => {
                            const stat = stats.find(s => s.id === p.user_id);
                            const isBest = bestMean !== null && stat?.mean === bestMean;
                            return (
                                <div key={p.id} className={`flex-1 min-w-[100px] flex items-center justify-center py-2 border-r border-[#333] last:border-0 ${isBest ? 'text-emerald-400 font-bold' : ''}`}>
                                    {stat?.meanStr}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex w-full bg-[#252525] border-b border-[#333] font-mono text-gray-300 mb-[1px]">
                        <div className="w-12 shrink-0 sticky left-0 z-10 flex items-center justify-center py-2 bg-[#252525] border-r border-[#333] text-[10px] font-sans text-gray-500 uppercase">
                            win
                        </div>
                        {participants.map(p => {
                            return (
                                <div key={p.id} className="flex-1 min-w-[100px] flex items-center justify-center py-2 border-r border-[#333] last:border-0 text-emerald-500/80">
                                    {stats.find(s => s.id === p.user_id)?.wins}
                                </div>
                            );
                        })}
                    </div>

                    {/* Data Rows */}
                    <div className="flex flex-col w-full">
                        {rows.map((round) => {
                            const isCurrentRound = round === scrambleIndex;
                            const isEven = round % 2 === 0;

                            return (
                                <div
                                    key={round}
                                    className={`flex w-full border-b border-[#333] ${isCurrentRound ? 'bg-blue-500/10' : isEven ? 'bg-[#1E1E1E]' : 'bg-[#252525]'}`}
                                >
                                    <div className={`w-12 shrink-0 sticky left-0 z-10 flex items-center justify-center py-1.5 font-mono border-r border-[#333] ${isCurrentRound ? 'text-blue-400 font-bold bg-[#1a202c]' : isEven ? 'bg-[#1E1E1E] text-gray-500' : 'bg-[#252525] text-gray-500'}`}>
                                        {round}
                                    </div>
                                    {participants.map(p => {
                                        const solve = p.solves.find(s => s.scramble_index === round);
                                        const bestTime = bestTimes[round];
                                        const userStatus = userStatuses[p.user_id];
                                        const isBest = solve && !solve.dnf && (solve.plus_two ? solve.time + 2 : solve.time) === bestTime && participants.length > 1;

                                        let cellContent = null;

                                        if (!solve) {
                                            if (isCurrentRound && userStatus) {
                                                if (userStatus.startsWith('DISCONNECTED')) {
                                                    const parts = userStatus.split('|');
                                                    const expireTime = parts.length > 1 ? parseInt(parts[1]) : 0;

                                                    cellContent = (
                                                        <div className="flex items-center gap-1.5 text-rose-500 animate-pulse bg-rose-500/10 px-2 py-0.5 rounded-sm">
                                                            <WifiSlash size={12} weight="bold" />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                                {t('room_table.disconnected')}
                                                                {expireTime > 0 && (
                                                                    <span className="opacity-90 font-mono">
                                                                        (<DisconnectTimer expireTime={expireTime} />)
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                } else {
                                                    const statusText = getStatusText(userStatus);
                                                    cellContent = (
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm ${userStatus === 'TIMING' ? 'text-emerald-400 bg-emerald-400/10' :
                                                            userStatus.includes('INSPECTING') ? 'text-amber-400 bg-amber-400/10' :
                                                                'text-gray-500'
                                                            }`}>
                                                            {statusText}
                                                        </span>
                                                    );
                                                }
                                            } else {
                                                cellContent = <span className="text-gray-700">-</span>;
                                            }
                                        } else {
                                            const solveTime = solve.plus_two ? solve.time + 2 : solve.time;

                                            cellContent = (
                                                <span className={`font-mono tracking-tight ${solve.dnf ? 'text-rose-400' :
                                                    isBest ? 'text-emerald-400 font-bold' :
                                                        'text-gray-200'
                                                    }`}>
                                                    {solve.dnf ? 'DNF' : getTimeString(solveTime) + (solve.plus_two ? '+' : '')}
                                                </span>
                                            );
                                        }

                                        return (
                                            <div
                                                key={p.id}
                                                className={`flex-1 min-w-[100px] flex items-center justify-center py-1.5 border-r border-[#333] last:border-0`}
                                            >
                                                {cellContent}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        <div className="h-8 w-full bg-[#1E1E1E]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
