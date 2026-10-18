/**
 * CommunityBanner: the wide "Community Sets" entry at the top of My Sets, the storefront of the
 * Algorithm Sets section. Shown to visitors too (above the sign-in screen), because Community Sets
 * is open to them.
 */
import React from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {CaretRight, Storefront} from 'phosphor-react';
import block from '../../../styles/bem';
import {COMMUNITY_PATH} from '../../../util/trainer/url/trainer_url';
import './AlgSets.scss';

const b = block('alg-sets');

export default function CommunityBanner() {
	const {t} = useTranslation();
	return (
		<div className={b('community-wrap')}>
			<Link to={COMMUNITY_PATH} className={b('community-banner')}>
				<span className={b('community-icon')} aria-hidden="true">
					<Storefront size={24} weight="duotone" />
				</span>
				<span className={b('community-text')}>
					<span className={b('community-title')}>{t('trainer.hub.community_title')}</span>
					<span className={b('community-desc')}>{t('trainer.hub.community_desc')}</span>
				</span>
				<CaretRight className={b('community-go')} size={18} weight="bold" aria-hidden="true" />
			</Link>
		</div>
	);
}
