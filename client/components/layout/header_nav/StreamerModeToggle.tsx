import React from 'react';
import { Broadcast } from 'phosphor-react';
import { useTranslation } from 'react-i18next';
import block from '../../../styles/bem';
import './StreamerModeToggle.scss';
import { useMe } from '../../../util/hooks/useMe';
import { useSettings } from '../../../util/hooks/useSettings';
import { toggleSetting } from '../../../db/settings/update';
import { canUseStreamerMode } from '../../../lib/streamer-mode';

const b = block('streamer-mode-toggle');

// Desktop header toggle (next to ThemeToggle) that mirrors ONLY the timer's time
// display (scaleX(-1)) so a streamer's front camera flips it back to readable.
// Visible only to the admin + the streamer; everyone else renders nothing.
export default function StreamerModeToggle() {
	const { t } = useTranslation();
	const me = useMe();
	const active = useSettings('streamer_mode');

	if (!canUseStreamerMode(me)) {
		return null;
	}

	const label = t('quick_controls.streamer_mode');

	return (
		<button
			type="button"
			className={b({ active: !!active })}
			aria-label={label}
			aria-pressed={!!active}
			title={label}
			onClick={() => toggleSetting('streamer_mode')}
		>
			<Broadcast weight={active ? 'fill' : 'regular'} size={18} />
		</button>
	);
}
