import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useEventListener } from '../util/event_handler';

interface DataContextType {
	settingsChangeCounter: number;
	solveDbChangeCounter: number;
	sessionDbChangeCounter: number;
	trainerDbChangeCounter: number;
}

const DataContext = createContext<DataContextType>({
	settingsChangeCounter: 0,
	solveDbChangeCounter: 0,
	sessionDbChangeCounter: 0,
	trainerDbChangeCounter: 0,
});

export function useDataContext() {
	return useContext(DataContext);
}

interface DataProviderProps {
	children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
	const [settingsChangeCounter, setSettingsChangeCounter] = useState(0);
	const [solveDbChangeCounter, setSolveDbChangeCounter] = useState(0);
	const [sessionDbChangeCounter, setSessionDbChangeCounter] = useState(0);
	const [trainerDbChangeCounter, setTrainerDbChangeCounter] = useState(0);

	// SINGLE subscription per event across entire app
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

	const value: DataContextType = {
		settingsChangeCounter,
		solveDbChangeCounter,
		sessionDbChangeCounter,
		trainerDbChangeCounter,
	};

	return (
		<DataContext.Provider value={value}>
			{children}
		</DataContext.Provider>
	);
}
