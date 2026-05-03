import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {Crown, ArrowRight} from 'phosphor-react';
import block from '../../../styles/bem';
import './ProBlurOverlay.scss';

const b = block('pro-blur-overlay');

const DUMMY_BAR_WIDTHS = [85, 70, 90, 55, 75, 65];

interface Props {
	title: string;
	description?: string;
	onBeforeNavigate?: () => void;
	minHeight?: number;
}

export default function ProBlurOverlay({title, description, onBeforeNavigate, minHeight}: Props) {
	const {t} = useTranslation();
	const history = useHistory();

	function handleClick() {
		if (onBeforeNavigate) onBeforeNavigate();
		history.push('/pro');
	}

	const style = minHeight ? {minHeight: `${minHeight}px`} : undefined;

	return (
		<div className={b()} style={style}>
			<div className={b('backdrop')} aria-hidden="true">
				{DUMMY_BAR_WIDTHS.map((w, i) => (
					<div key={i} className={b('backdrop-bar')} style={{width: `${w}%`}} />
				))}
			</div>

			<div className={b('card')}>
				<div className={b('icon')}>
					<Crown weight="fill" />
				</div>
				<div className={b('eyebrow')}>{t('pro.feature_title')}</div>
				<h3 className={b('title')}>{title}</h3>
				{description && <p className={b('description')}>{description}</p>}
				<button type="button" className={b('cta')} onClick={handleClick}>
					<span>{t('pro.upgrade_button')}</span>
					<ArrowRight weight="bold" />
				</button>
			</div>
		</div>
	);
}
