import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import { TimerSettingsGroup } from '../timer/TimerSettingsRow';
import { FlagIcon, LANG_OPTIONS } from '../../common/language_switcher/LanguageSwitcher';

const LANGUAGE_SEARCH_TEXT = LANG_OPTIONS.map((lang) => lang.label);

export default function LanguageSettings() {
	const { t, i18n } = useTranslation();

	const currentLang = LANG_OPTIONS.find((l) => i18n.language?.startsWith(l.code))?.code || 'en';

	// The server copy (settings.locale) follows through client/i18n/server-locale-sync.ts.
	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
	}

	return (
		<div className="space-y-2">
			<TimerSettingsGroup
				id="language-language"
				label={t('language.category_language')}
				// The list below is plain buttons, not settings rows, so the group filter
				// finds no label to match. Searching "english" has to reach it.
				searchText={LANGUAGE_SEARCH_TEXT}
			>
				<div className="space-y-2">
					{LANG_OPTIONS.map((lang) => {
						const isActive = currentLang === lang.code;
						return (
							<button
								key={lang.code}
								type="button"
								onClick={() => changeLanguage(lang.code)}
								// Selected option (K7): accent hairline, light accent tint, tick. The
								// others sit on the quiet card surface: on the button fill they read
								// heavier than the selected row.
								className={`w-full flex items-center justify-between py-4 px-4 rounded-xl border transition-all duration-200 cursor-pointer ${isActive
									? 'bg-primary/[0.08] border-primary text-text'
									: 'bg-text/[0.035] border-text/[0.09] text-text hover:bg-text/[0.06] hover:border-text/[0.15]'
									}`}
							>
								<span className="flex items-center gap-3">
									<FlagIcon code={lang.flag} size={22} />
									<span className="font-medium">{lang.label}</span>
								</span>
								{isActive && <Check size={18} weight="bold" className="text-primary" />}
							</button>
						);
					})}
				</div>
			</TimerSettingsGroup>
		</div>
	);
}
