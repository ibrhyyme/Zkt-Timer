// Sol drawer ic icerigi — 3 tab. Tum tab componentleri quick-controls'tan
// `as-is` reuse (TimerTab, ExtrasTab, GoalsTab). Sifir duplikasyon.
//
// Default tab: 'timer' — gear butonu kalkmadan once TimerTypePicker ust banttaydi,
// kullanici en sik bunu degistirirdi. Default acilis bu sayfaya gelir.

import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import TimerTab from '../../../quick-controls/tabs/TimerTab';
import ExtrasTab from '../../../quick-controls/tabs/ExtrasTab';
import GoalsTab from '../../../quick-controls/tabs/GoalsTab';
import block from '../../../../styles/bem';
import './DrawerSettingsContent.scss';

const b = block('drawer-settings-content');

type Tab = 'timer' | 'extras' | 'goals';

export default function DrawerSettingsContent() {
	const {t} = useTranslation();
	const [tab, setTab] = useState<Tab>('timer');

	return (
		<div className={b()}>
			<div className={b('tabs')}>
				<button
					type="button"
					className={b('tab', {active: tab === 'timer'})}
					onClick={() => setTab('timer')}
				>
					{t('quick_controls.timer')}
				</button>
				<button
					type="button"
					className={b('tab', {active: tab === 'extras'})}
					onClick={() => setTab('extras')}
				>
					{t('quick_controls.extras')}
				</button>
				<button
					type="button"
					className={b('tab', {active: tab === 'goals'})}
					onClick={() => setTab('goals')}
				>
					{t('quick_controls.goals')}
				</button>
			</div>
			<div className={b('content')}>
				{tab === 'timer' && <TimerTab />}
				{tab === 'extras' && <ExtrasTab />}
				{tab === 'goals' && <GoalsTab />}
			</div>
		</div>
	);
}
