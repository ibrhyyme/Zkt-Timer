import React from 'react';
import type {TFunction} from 'i18next';
import {openModal} from '../../../actions/general';
import ProOnlyModal from './ProOnlyModal';

type AnyDispatch = (action: any) => void;

export function openProOnlyModal(dispatch: AnyDispatch, t: TFunction, featureKey?: string) {
	dispatch(
		openModal(<ProOnlyModal featureKey={featureKey} />, {
			compact: true,
			width: 420,
			closeButtonText: t('solve_info.done'),
		}),
	);
}
