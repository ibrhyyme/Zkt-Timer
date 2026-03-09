import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import dayjs from 'dayjs';
import { TimerSettingsGroup } from '../timer/TimerSettingsRow';

interface LanguageOption {
	code: string;
	nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
	{ code: 'tr', nativeName: 'Türkçe' },
	{ code: 'en', nativeName: 'English' },
	{ code: 'es', nativeName: 'Español' },
	{ code: 'ru', nativeName: 'Русский' },
];

export default function LanguageSettings() {
	const { t, i18n } = useTranslation();

	const currentLang = LANGUAGES.find((l) => i18n.language?.startsWith(l.code))?.code || 'tr';

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		dayjs.locale(lng);
	}

	return (
		<div className="space-y-2">
			<TimerSettingsGroup id="language-language" label={t('language.category_language')}>
				<div className="space-y-2">
					{LANGUAGES.map((lang) => {
						const isActive = currentLang === lang.code;
						return (
							<button
								key={lang.code}
								type="button"
								onClick={() => changeLanguage(lang.code)}
								className={`w-full flex items-center justify-between py-4 px-4 rounded-xl border transition-all duration-200 cursor-pointer ${isActive
									? 'bg-[#4a9eff]/10 border-[#4a9eff] text-white'
									: 'bg-[#1c1c1e] border-white/[0.08] text-[#888] hover:border-white/[0.15] hover:text-slate-200'
									}`}
							>
								<span className="font-medium">{lang.nativeName}</span>
								{isActive && <Check size={18} weight="bold" className="text-[#4a9eff]" />}
							</button>
						);
					})}
				</div>
			</TimerSettingsGroup>
		</div>
	);
}
