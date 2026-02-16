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
				className="max-w-5xl w-full max-h-[85vh] rounded-3xl bg-[#12141c] border border-white/[0.08] shadow-2xl shadow-black/50 transform transition-all duration-300 flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Sticky Header */}
				<div className="sticky top-0 z-10 bg-[#12141c] border-b border-white/[0.08] rounded-t-3xl p-6 pb-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-1 bg-[#1c1c1e] rounded-full p-1">
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'timer'
										? 'bg-[#4a9eff] text-white'
										: 'text-[#888] hover:text-white hover:bg-[#2a2a2e]'
								}`}
								onClick={() => setActiveTab('timer')}
							>
								Timer
							</button>
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'appearance'
										? 'bg-[#4a9eff] text-white'
										: 'text-[#888] hover:text-white hover:bg-[#2a2a2e]'
								}`}
								onClick={() => setActiveTab('appearance')}
							>
								Görünüm
							</button>
							<button
								type="button"
								className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
									activeTab === 'data'
										? 'bg-[#4a9eff] text-white'
										: 'text-[#888] hover:text-white hover:bg-[#2a2a2e]'
								}`}
								onClick={() => setActiveTab('data')}
							>
								Veri
							</button>
						</div>
						<button
							ref={closeButtonRef}
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1e] hover:bg-[#2a2a2e] text-slate-300 hover:text-white transition-all duration-200"
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