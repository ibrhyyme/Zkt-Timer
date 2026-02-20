import React from 'react';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';
import SettingRow from '../setting/row/SettingRow';
import dayjs from 'dayjs';

interface LanguageOption {
	code: string;
	labelKey: string;
	nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
	{code: 'tr', labelKey: 'language.turkish', nativeName: 'Türkçe'},
	{code: 'en', labelKey: 'language.english', nativeName: 'English'},
];

export default function LanguageSettings() {
	const {t, i18n} = useTranslation();

	const currentLang = LANGUAGES.find((l) => i18n.language?.startsWith(l.code))?.code || 'tr';

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		dayjs.locale(lng);
	}

	return (
		<SettingRow title={t('language.label')} description={t('language.description')} vertical>
			<div style={{display: 'flex', flexDirection: 'column', gap: '8px', width: '100%'}}>
				{LANGUAGES.map((lang) => {
					const isActive = currentLang === lang.code;
					return (
						<button
							key={lang.code}
							type="button"
							onClick={() => changeLanguage(lang.code)}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								padding: '12px 16px',
								borderRadius: '12px',
								border: isActive ? '2px solid #4a9eff' : '2px solid rgba(255,255,255,0.08)',
								background: isActive ? 'rgba(74,158,255,0.1)' : 'rgba(255,255,255,0.03)',
								color: isActive ? '#fff' : '#888',
								cursor: 'pointer',
								transition: 'all 0.2s',
								fontSize: '14px',
								fontWeight: 500,
							}}
						>
							<span>{lang.nativeName}</span>
							{isActive && <Check size={18} weight="bold" color="#4a9eff" />}
						</button>
					);
				})}
			</div>
		</SettingRow>
	);
}
