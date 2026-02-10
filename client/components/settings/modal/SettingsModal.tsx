import React, {useState, useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'phosphor-react';
import './SettingsModal.scss';
import TimerSettings from '../timer/TimerSettings';
import Appearance from '../appearance/Appearance';
import DataSettings from '../data/DataSettings';

interface Props {
	onClose?: () => void;
	initialTab?: string;
	isOpen?: boolean;
}

export default function SettingsModal(props: Props) {
	const {onClose, initialTab = 'timer', isOpen = true} = props;
	const [activeTab, setActiveTab] = useState(initialTab);
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	if (!isOpen) {
		return null;
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget && onClose) {
			onClose();
		}
	}

	function handleClose() {
		if (onClose) {
			onClose();
		}
	}

	function renderTabContent() {
		switch (activeTab) {
			case 'timer':
				return <TimerSettings />;
			case 'appearance':
				return <Appearance />;
			case 'data':
				return <DataSettings />;
			default:
				return <TimerSettings />;
		}
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[70] bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200"
			onClick={handleBackdropClick}
		>
			<div 
				className="max-w-5xl w-full max-h-[85vh] rounded-3xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 transform transition-all duration-300 flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Sticky Header */}
				<div className="sticky top-0 z-10 bg-gradient-to-br from-slate-900/98 to-slate-800/98 backdrop-blur-xl border-b border-white/5 rounded-t-3xl p-6 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-1 bg-slate-800/70 rounded-full p-1 shadow-lg">
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'timer'
										? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
										: 'text-slate-200 hover:text-white hover:bg-slate-600/70'
								}`}
								onClick={() => setActiveTab('timer')}
							>
								Timer
							</button>
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'appearance'
										? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
										: 'text-slate-200 hover:text-white hover:bg-slate-600/70'
								}`}
								onClick={() => setActiveTab('appearance')}
							>
								Görünüm
							</button>
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'data'
										? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
										: 'text-slate-200 hover:text-white hover:bg-slate-600/70'
								}`}
								onClick={() => setActiveTab('data')}
							>
								Veri
							</button>
						</div>
						<button
							ref={closeButtonRef}
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/70 hover:bg-slate-600/70 text-slate-200 hover:text-white transition-all duration-200 hover:scale-105 shadow-lg"
							onClick={handleClose}
							aria-label="Kapat"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto p-6 pt-4">
					<div className="min-h-[300px] settings-content">
						{renderTabContent()}
					</div>
				</div>
			</div>
		</div>,
		document.body
	);
}