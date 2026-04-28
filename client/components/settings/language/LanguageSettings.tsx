import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'phosphor-react';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { useMutation, gql } from '@apollo/client';
import { TimerSettingsGroup } from '../timer/TimerSettingsRow';

const UPDATE_LOCALE = gql`
	mutation UpdateLocale($locale: String!) {
		setSetting(input: { locale: $locale }) {
			id
		}
	}
`;

interface LanguageOption {
	code: string;
	nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
	{ code: 'tr', nativeName: 'Türkçe' },
	{ code: 'en', nativeName: 'English' },
	{ code: 'es', nativeName: 'Español' },
	{ code: 'ru', nativeName: 'Русский' },
	{ code: 'zh', nativeName: '中文' },
];

export default function LanguageSettings() {
	const { t, i18n } = useTranslation();
	const me = useSelector((state: any) => state.account.me);
	const [updateLocale] = useMutation(UPDATE_LOCALE);

	const currentLang = LANGUAGES.find((l) => i18n.language?.startsWith(l.code))?.code || 'en';

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		dayjs.locale(lng);
		if (me?.id) {
			updateLocale({ variables: { locale: lng } }).catch(() => {});
		}
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
									? 'bg-primary/10 border-primary text-text'
									: 'bg-button border-text/[0.08] text-text/50 hover:border-text/[0.15] hover:text-text/80'
									}`}
							>
								<span className="font-medium">{lang.nativeName}</span>
								{isActive && <Check size={18} weight="bold" className="text-primary" />}
							</button>
						);
					})}
				</div>
			</TimerSettingsGroup>
		</div>
	);
}
