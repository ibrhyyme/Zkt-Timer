import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'phosphor-react';
import Dropdown from '../inputs/dropdown/Dropdown';
import dayjs from 'dayjs';

export default function LanguageSwitcher() {
	const { i18n, t } = useTranslation();

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		dayjs.locale(lng);
	}

	const supportedLangs = ['tr', 'en', 'es', 'ru'];
	const currentLang = supportedLangs.find((s) => i18n.language?.startsWith(s)) || 'tr';

	return (
		<Dropdown
			noMargin
			icon={<Globe weight="bold" />}
			text={currentLang.toUpperCase()}
			options={[
				{
					text: t('language.turkish'),
					onClick: () => changeLanguage('tr'),
					disabled: currentLang === 'tr',
				},
				{
					text: t('language.english'),
					onClick: () => changeLanguage('en'),
					disabled: currentLang === 'en',
				},
				{
					text: t('language.spanish'),
					onClick: () => changeLanguage('es'),
					disabled: currentLang === 'es',
				},
				{
					text: t('language.russian'),
					onClick: () => changeLanguage('ru'),
					disabled: currentLang === 'ru',
				},
			]}
		/>
	);
}
