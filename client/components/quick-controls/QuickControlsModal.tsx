import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {createPortal} from 'react-dom';
import {X} from 'phosphor-react';
import {useQuickControlsModal} from './useQuickControlsModal';
import TimerTab from './tabs/TimerTab';
import ExtrasTab from './tabs/ExtrasTab';

export default function QuickControlsModal() {
	const {t} = useTranslation();
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
				className="max-w-lg w-full rounded-3xl bg-[#12141c] border border-white/[0.08] shadow-2xl shadow-black/50 p-8 transform transition-all duration-300"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-8">
					<div className="flex items-center space-x-1 bg-[#1c1c1e] rounded-full p-1">
						<button
							type="button"
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								activeTab === 'timer'
									? 'bg-[#4a9eff] text-white'
									: 'text-slate-300 hover:text-white hover:bg-slate-700/50'
							}`}
							onClick={() => setActiveTab('timer')}
						>
							{t('quick_controls.timer')}
						</button>
						<button
							type="button"
							className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
								activeTab === 'extras'
									? 'bg-[#4a9eff] text-white'
									: 'text-slate-300 hover:text-white hover:bg-slate-700/50'
							}`}
							onClick={() => setActiveTab('extras')}
						>
							{t('quick_controls.extras')}
						</button>
					</div>
					<button
						ref={closeButtonRef}
						type="button"
						className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1e] hover:bg-[#2a2a2e] text-slate-300 hover:text-white transition-all duration-200"
						onClick={close}
						aria-label={t('common.close')}
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
