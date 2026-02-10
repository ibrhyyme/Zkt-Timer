import React, {useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'phosphor-react';
import {useQuickControlsModal} from './useQuickControlsModal';
import TimerTab from './tabs/TimerTab';
import ExtrasTab from './tabs/ExtrasTab';

export default function QuickControlsModal() {
	const {isOpen, activeTab, close, setActiveTab} = useQuickControlsModal();
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	if (!isOpen) {
		return null;
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[70] bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200"
			onClick={handleBackdropClick}
		>
			<div 
				className="max-w-lg w-full rounded-3xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 p-8 transform transition-all duration-300"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div className="flex items-center space-x-1 bg-slate-800/50 rounded-full p-1">
						<button
							type="button"
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								activeTab === 'timer'
									? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
									: 'text-slate-300 hover:text-white hover:bg-slate-700/50'
							}`}
							onClick={() => setActiveTab('timer')}
						>
							Timer
						</button>
						<button
							type="button"
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								activeTab === 'extras'
									? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
									: 'text-slate-300 hover:text-white hover:bg-slate-700/50'
							}`}
							onClick={() => setActiveTab('extras')}
						>
							Ek Özellikler
						</button>
					</div>
					<button
						ref={closeButtonRef}
						type="button"
						className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-all duration-200 hover:scale-105"
						onClick={close}
						aria-label="Kapat"
					>
						<X size={18} />
					</button>
				</div>

				{/* Tab Content */}
				<div className="min-h-[320px]">
					{activeTab === 'timer' && <TimerTab />}
					{activeTab === 'extras' && <ExtrasTab />}
				</div>
			</div>
		</div>,
		document.body
	);
}
