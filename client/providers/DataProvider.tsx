import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useEventListener } from '../util/event_handler';
import { startActivityHeartbeat, stopActivityHeartbeat } from '../util/activity-heartbeat';

// One context per counter, each holding a bare number. When all four shared one
// context object, saving a solve re-rendered every component that reads a setting.
const SettingsChangeContext = createContext(0);
const SolveDbChangeContext = createContext(0);
const SessionDbChangeContext = createContext(0);
const TrainerDbChangeContext = createContext(0);

export function useSettingsChangeCounter(): number {
	return useContext(SettingsChangeContext);
}

export function useSolveDbChangeCounter(): number {
	return useContext(SolveDbChangeContext);
}

export function useSessionDbChangeCounter(): number {
	return useContext(SessionDbChangeContext);
}

export function useTrainerDbChangeCounter(): number {
	return useContext(TrainerDbChangeContext);
}

interface DataProviderProps {
	children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
	const [settingsChangeCounter, setSettingsChangeCounter] = useState(0);
	const [solveDbChangeCounter, setSolveDbChangeCounter] = useState(0);
	const [sessionDbChangeCounter, setSessionDbChangeCounter] = useState(0);
	const [trainerDbChangeCounter, setTrainerDbChangeCounter] = useState(0);

	// Single subscription per event across entire app
	useEventListener('settingsDbUpdatedEvent', () => {
		setSettingsChangeCounter(prev => prev + 1);
	});

	useEventListener('solveDbUpdatedEvent', () => {
		setSolveDbChangeCounter(prev => prev + 1);
	});

	useEventListener('sessionsDbUpdatedEvent', () => {
		setSessionDbChangeCounter(prev => prev + 1);
	});

	useEventListener('trainerDbUpdatedEvent', () => {
		setTrainerDbChangeCounter(prev => prev + 1);
	});

	useEventListener('trainerDbDeletedEvent', () => {
		setTrainerDbChangeCounter(prev => prev + 1);
	});

	// Heartbeat for logged-in users — activity tracking for admin panel
	const meId = useSelector((s: any) => s?.account?.me?.id) as string | undefined;
	useEffect(() => {
		if (!meId) return;
		startActivityHeartbeat();
		return () => stopActivityHeartbeat();
	}, [meId]);

	return (
		<SettingsChangeContext.Provider value={settingsChangeCounter}>
			<SolveDbChangeContext.Provider value={solveDbChangeCounter}>
				<SessionDbChangeContext.Provider value={sessionDbChangeCounter}>
					<TrainerDbChangeContext.Provider value={trainerDbChangeCounter}>
						{children}
					</TrainerDbChangeContext.Provider>
				</SessionDbChangeContext.Provider>
			</SolveDbChangeContext.Provider>
		</SettingsChangeContext.Provider>
	);
}
