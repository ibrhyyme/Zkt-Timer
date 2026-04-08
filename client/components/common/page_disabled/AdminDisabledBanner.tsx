import React from 'react';
import {useTranslation} from 'react-i18next';
import {Warning} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('admin-disabled-banner');

interface Props {
	pageName: string;
}

export default function AdminDisabledBanner({pageName}: Props) {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<Warning size={16} weight="fill" />
			<span>{t('site_config.admin_disabled_banner', {page: pageName})}</span>
		</div>
	);
}
