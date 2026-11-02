import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useLocation} from 'react-router-dom';
import {ArrowLeft} from 'phosphor-react';
import './Legal.scss';
import block from '../../../styles/bem';
import {isNative} from '../../../util/platform';
import Header from '../../layout/header/Header';
import Button from '../../common/button/Button';

const b = block('landing-legal');

// Public on purpose. Google Play's Data Safety form needs a deletion address that opens
// without an account, including for someone who already removed the app. The delete
// itself stays behind login, in /account/danger-zone.
export default function DeleteAccount() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();

	return (
		<div className={b()}>
			<Header path={location.pathname} />
			{isNative() && (
				<button type="button" className={b('back-btn')} onClick={() => history.goBack()}>
					<ArrowLeft weight="bold" size={20} />
				</button>
			)}
			<h1>{t('delete_account.title')}</h1>
			<p>{t('delete_account.intro')}</p>

			<h2>{t('delete_account.steps_title')}</h2>
			<ol>
				<li>{t('delete_account.step_1')}</li>
				<li>{t('delete_account.step_2')}</li>
				<li>{t('delete_account.step_3')}</li>
			</ol>
			<Button primary large text={t('delete_account.button')} to="/account/danger-zone" />

			<h2>{t('delete_account.no_login_title')}</h2>
			<p dangerouslySetInnerHTML={{__html: t('delete_account.no_login_text')}} />

			<h2>{t('delete_account.deleted_title')}</h2>
			<p>{t('delete_account.deleted_text')}</p>

			<h2>{t('delete_account.kept_title')}</h2>
			<p>{t('delete_account.kept_text')}</p>
		</div>
	);
}
