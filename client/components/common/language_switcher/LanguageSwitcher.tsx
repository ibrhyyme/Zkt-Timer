import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'phosphor-react';
import Dropdown from '../inputs/dropdown/Dropdown';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { useMutation, gql } from '@apollo/client';

const UPDATE_LOCALE = gql`
	mutation UpdateLocale($locale: String!) {
		setSetting(input: { locale: $locale }) {
			id
		}
	}
`;

interface Props {
	openLeft?: boolean;
}

export default function LanguageSwitcher(props: Props = {}) {
	const {openLeft} = props;
	const { i18n } = useTranslation();
	const me = useSelector((state: any) => state.account.me);
	const [updateLocale] = useMutation(UPDATE_LOCALE);

	function changeLanguage(lng: string) {
		i18n.changeLanguage(lng);
		dayjs.locale(lng);
		if (me?.id) {
			updateLocale({ variables: { locale: lng } }).catch(() => {});
		}
	}

	const supportedLangs = ['tr', 'en', 'es', 'ru', 'zh'];
	const currentLang = supportedLangs.find((s) => i18n.language?.startsWith(s)) || 'en';

	return (
		<Dropdown
			noMargin
			openLeft={openLeft}
			icon={<Globe weight="bold" />}
			text={currentLang.toUpperCase()}
			options={[
				{ text: 'Türkçe',  onClick: () => changeLanguage('tr'), disabled: currentLang === 'tr' },
				{ text: 'English', onClick: () => changeLanguage('en'), disabled: currentLang === 'en' },
				{ text: 'Español', onClick: () => changeLanguage('es'), disabled: currentLang === 'es' },
				{ text: 'Русский', onClick: () => changeLanguage('ru'), disabled: currentLang === 'ru' },
				{ text: '中文',    onClick: () => changeLanguage('zh'), disabled: currentLang === 'zh' },
			]}
		/>
	);
}
