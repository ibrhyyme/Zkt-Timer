import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resourceUri } from '../../../util/storage';
import block from '../../../styles/bem';

const b = block('zkt-auth');

export type AuthMode = 'login' | 'signup' | 'wca-callback' | 'wca-conflict' | 'legacy';

interface Props {
	mode: AuthMode;
	setMode: (mode: AuthMode) => void;
	children: ReactNode;
}

export default function AuthCard({ mode, setMode, children }: Props) {
	const { t } = useTranslation();

	const showTabs = mode === 'login' || mode === 'signup';

	return (
		<div className={b('card')}>
			<div className={b('logo-container')}>
				<img
					src={resourceUri('/images/zkt-logo.png')}
					alt="Zeka Küpü Türkiye"
					className={b('logo')}
				/>
			</div>

			{showTabs && (
				<div className={b('tabs-underline')}>
					<button
						type="button"
						className={b('tab-underline', { active: mode === 'login' })}
						onClick={() => setMode('login')}
					>
						{t('login_wrapper.login')}
					</button>
					<button
						type="button"
						className={b('tab-underline', { active: mode === 'signup' })}
						onClick={() => setMode('signup')}
					>
						{t('login_wrapper.signup')}
					</button>
				</div>
			)}

			<div className={b('mode-stage')}>
				<div key={mode} className={b('mode-pane')}>
					{children}
				</div>
			</div>
		</div>
	);
}
