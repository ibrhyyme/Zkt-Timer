import React, {createContext, ReactNode, useCallback, useContext, useEffect, useState} from 'react';

export type QuickControlsTab = 'timer' | 'extras';

interface QuickControlsContextValue {
	isOpen: boolean;
	activeTab: QuickControlsTab;
	open: (tab?: QuickControlsTab) => void;
	close: () => void;
	setActiveTab: (tab: QuickControlsTab) => void;
}

const QuickControlsContext = createContext<QuickControlsContextValue | null>(null);

interface QuickControlsProviderProps {
	children: ReactNode;
}

export function QuickControlsProvider({children}: QuickControlsProviderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<QuickControlsTab>('timer');

	const open = useCallback((tab: QuickControlsTab = 'timer') => {
		setActiveTab(tab);
		setIsOpen(true);
		document.body.style.overflow = 'hidden';
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
		document.body.style.overflow = '';
	}, []);

	// Close on route change
	useEffect(() => {
		if (isOpen) {
			const handlePopstate = () => close();
			window.addEventListener('popstate', handlePopstate);
			return () => window.removeEventListener('popstate', handlePopstate);
		}
	}, [isOpen, close]);

	// Close on ESC key
	useEffect(() => {
		if (isOpen) {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					close();
				}
			};
			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}
	}, [isOpen, close]);

	const value: QuickControlsContextValue = {
		isOpen,
		activeTab,
		open,
		close,
		setActiveTab,
	};

	return <QuickControlsContext.Provider value={value}>{children}</QuickControlsContext.Provider>;
}

export function useQuickControlsModal() {
	const context = useContext(QuickControlsContext);
	if (!context) {
		throw new Error('useQuickControlsModal must be used within a QuickControlsProvider');
	}
	return context;
}
