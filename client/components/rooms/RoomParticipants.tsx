import React from 'react';
import { FriendlyRoomParticipantData } from '../../../shared/friendly_room';
import { Crown, Check, Timer } from 'phosphor-react';
import { getTimeString } from '../../util/time';

interface RoomParticipantsProps {
    participants: FriendlyRoomParticipantData[];
    currentScrambleIndex: number;
    hostId: string;
}

export default function RoomParticipants({ participants, currentScrambleIndex, hostId }: RoomParticipantsProps) {
    // Sort participants: host first, then by solve count
    const sortedParticipants = [...participants].sort((a, b) => {
        if (a.user_id === hostId) return -1;
        if (b.user_id === hostId) return 1;
        return b.solves.length - a.solves.length;
    });

    return (
        <div className="flex flex-col w-full h-full bg-[#15161A]">
            <div className="shrink-0 p-3 border-b border-gray-800 bg-[#15161A] text-xs font-bold uppercase tracking-wider text-gray-400">
                KATILIMCILAR ({participants.length})
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scroll-smooth">
                {sortedParticipants.map((participant) => {
                    const isHost = participant.user_id === hostId;
                    const currentSolve = participant.solves.find(
                        (s) => s.scramble_index === currentScrambleIndex
                    );
                    const hasSolvedCurrent = !!currentSolve;

                    return (
                        <div
                            key={participant.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${hasSolvedCurrent
                                    ? 'bg-[#0f1014] border-gray-800 opacity-60'
                                    : 'bg-[#1a1b1f] border-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                {isHost && (
                                    <Crown size={16} weight="fill" className="text-orange-500" />
                                )}
                                <span className={`font-medium ${isHost ? 'text-white' : 'text-gray-200'}`}>
                                    {participant.username}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasSolvedCurrent ? (
                                    <>
                                        <Check size={14} weight="bold" className="text-green-500" />
                                        <span className="font-mono text-sm text-gray-400">
                                            {currentSolve.dnf
                                                ? 'DNF'
                                                : getTimeString(
                                                    currentSolve.plus_two
                                                        ? currentSolve.time + 2
                                                        : currentSolve.time
                                                )}
                                        </span>
                                    </>
                                ) : (
                                    <Timer size={14} className="text-gray-600 animate-pulse" />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
