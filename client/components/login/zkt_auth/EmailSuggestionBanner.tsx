import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningCircle } from 'phosphor-react';
import { suggestEmailDomain } from '../../../util/auth/email';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	value: string;
	onAccept: (fullEmail: string) => void;
}

export default function EmailSuggestionBanner({ value, onAccept }: Props) {
	const { t } = useTranslation();
	const suggestion = useMemo(() => suggestEmailDomain(value || ''), [value]);

	if (!suggestion) return null;

	if (suggestion.hasInvalidChars && !suggestion.suggestedDomain) {
		return (
			<div className={b('suggest')}>
				<WarningCircle size={12} weight="fill" />
				{t('signup.email_invalid_chars')}
			</div>
		);
	}

	return (
		<button
			type="button"
			className={b('suggest')}
			onClick={() => onAccept(suggestion.fullEmail)}
		>
			<WarningCircle size={12} weight="fill" />
			<span>
				{suggestion.hasInvalidChars
					? t('signup.email_invalid_chars') + ' '
					: t('zkt_auth.email_suggest_cta') + ' '}
				<b>{suggestion.suggestedDomain}</b>
			</span>
		</button>
	);
}
