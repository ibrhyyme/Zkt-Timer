import React from 'react';
import {useTranslation} from 'react-i18next';
import {createPortal} from 'react-dom';
import {X} from 'phosphor-react';
import {useQuickControlsModal} from './useQuickControlsModal';
import TimerTab from './tabs/TimerTab';
import ExtrasTab from './tabs/ExtrasTab';
import GoalsTab from './tabs/GoalsTab';
import '../rooms/RoomSettingsModal.scss';

export default function QuickControlsModal() {
	const {t} = useTranslation();
	const {isOpen, activeTab, close, setActiveTab} = useQuickControlsModal();

	if (!isOpen) {
		return null;
	}

	function handleBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	return createPortal(
		<div className="room-settings-modal__backdrop" onClick={handleBackdropClick}>
			<div className="room-settings-modal" onClick={(e) => e.stopPropagation()}>
				<div className="room-settings-modal__header">
					<div className="room-settings-modal__tabs">
						<button
							type="button"
							className={`room-settings-modal__tab ${activeTab === 'timer' ? 'room-settings-modal__tab--active' : ''}`}
							onClick={() => setActiveTab('timer')}
						>
							{t('quick_controls.timer')}
						</button>
						<button
							type="button"
							className={`room-settings-modal__tab ${activeTab === 'extras' ? 'room-settings-modal__tab--active' : ''}`}
							onClick={() => setActiveTab('extras')}
						>
							{t('quick_controls.extras')}
						</button>
						<button
							type="button"
							className={`room-settings-modal__tab ${activeTab === 'goals' ? 'room-settings-modal__tab--active' : ''}`}
							onClick={() => setActiveTab('goals')}
						>
							{t('quick_controls.goals')}
						</button>
					</div>
					<button
						type="button"
						className="room-settings-modal__close"
						onClick={close}
						aria-label={t('common.close')}
					>
						<X size={18} />
					</button>
				</div>

				<div className="room-settings-modal__content overflow-y-auto">
					{activeTab === 'timer' && <TimerTab />}
					{activeTab === 'extras' && <ExtrasTab />}
					{activeTab === 'goals' && <GoalsTab />}
				</div>
			</div>
		</div>,
		document.body
	);
}
