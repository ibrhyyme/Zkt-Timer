import React from 'react';
import {SignIn} from 'phosphor-react';
import { useTranslation } from 'react-i18next';
import Button from '../../common/button/Button';
import {useMe} from '../../../util/hooks/useMe';

interface Props {
	collapsed: boolean;
}

export default function LoginNav(props: Props) {
	const { t } = useTranslation();
	const me = useMe();

	if (me) {
		return null;
	}

	if (props.collapsed) {
		return (
			<div className="mt-4">
				<Button icon={<SignIn weight="bold" />} to="/signup" gray />
			</div>
		);
	}

	return (
		<div className="mt-4 flex w-full flex-row gap-2">
			<Button text={t('nav.login')} to="/login" fullWidth gray />
			<Button text={t('nav.signup')} to="/signup" fullWidth primary />
		</div>
	);
}
