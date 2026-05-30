import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlagSvg, FlagCode } from './flag-icons.generated';
import FancyDropdown, { FancyDropdownOption } from '../../timer/header_control/FancyDropdown';
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

// i18n language code → ISO country code (for flag). en → us (global preference), zh → cn.
const LANG_OPTIONS: { code: string; flag: FlagCode; label: string }[] = [
	{ code: 'tr', flag: 'tr', label: 'Türkçe' },
	{ code: 'en', flag: 'us', label: 'English' },
	{ code: 'es', flag: 'es', label: 'Español' },
	{ code: 'ru', flag: 'ru', label: 'Русский' },
	{ code: 'zh', flag: 'cn', label: '中文' },
];

const FLAG_SIZE = 18;

// Fixed-size circular wrapper around the inline flag <svg>. The svg fills 100%
// and `overflow:hidden + border-radius:50%` clips it to a circle.
function FlagIcon({ code, size = FLAG_SIZE }: { code: FlagCode; size?: number }) {
	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: size,
				height: size,
				flexShrink: 0,
				overflow: 'hidden',
				borderRadius: '50%',
				lineHeight: 0,
			}}
		>
			<FlagSvg code={code} />
		</span>
	);
}

export default function LanguageSwitcher(_props: Props = {}) {
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

	const currentLang = LANG_OPTIONS.find((s) => i18n.language?.startsWith(s.code)) ?? LANG_OPTIONS[1];

	const options: FancyDropdownOption[] = LANG_OPTIONS.map((lang) => ({
		value: lang.code,
		label: lang.label,
		icon: <FlagIcon code={lang.flag} />,
	}));

	return (
		<FancyDropdown
			value={currentLang.code}
			onValueChange={changeLanguage}
			options={options}
			triggerIcon={<FlagIcon code={currentLang.flag} />}
			ariaLabel="Language"
			align="end"
			triggerMinWidth={56}
		/>
	);
}
