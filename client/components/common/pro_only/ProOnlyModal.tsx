import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import ModalHeader from '../modal/modal_header/ModalHeader';

const b = block('pro-only-modal');

export default function ProOnlyModal() {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<ModalHeader
				title={t('pro.feature_title')}
				description={t('pro.feature_description')}
			/>
		</div>
	);
}
