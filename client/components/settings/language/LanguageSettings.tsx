import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import { useSelector } from 'react-redux';
import { useMutation, gql } from '@apollo/client';
import { TimerSettingsGroup } from '../timer/TimerSettingsRow';
import { FlagIcon, LANG_OPTIONS } from '../../common/language_switcher/LanguageSwitcher';

const UPDATE_LOCALE = gql`
	mutation UpdateLocale($locale: String!) {
		setSetting(input: { locale: $locale }) {
			id
		}
	}
`;

const LANGUAGE_SEARCH_TEXT = LANG_OPTIONS.map((lang) => lang.label);

export default function LanguageSettings() {
	const { t, i18n } = useTranslation();
	const me = useSelector((state: any) => state.account.me);
	const [updateLocale] = useMutation(UPDATE_LOCALE);

	const currentLang = LANG_OPTIONS.find((l) => i18n.language?.startsWith(l.code))?.code || 'en';

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		if (me?.id) {
			updateLocale({ variables: { locale: lng } }).catch(() => {});
		}
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
								className={`w-full flex items-center justify-between py-4 px-4 rounded-xl border transition-all duration-200 cursor-pointer ${isActive
									? 'bg-primary/10 border-primary text-text'
									: 'bg-button border-text/[0.08] text-text hover:border-text/[0.15]'
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
