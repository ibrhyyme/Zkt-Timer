import React, { useContext } from 'react';
import './JoinOptions.scss';
import { UsersThree, UserPlus } from 'phosphor-react';
import block from '../../../../../styles/bem';
import { MatchPopupContext, MatchPopupPage } from '../MatchPopup';
import { useTranslation } from 'react-i18next';

const b = block('match-join-options');

export default function JoinOptions() {
	const { setPage } = useContext(MatchPopupContext);
	const { t } = useTranslation();

	return (
		<div className={b()}>
			<button className={b('option')} onClick={() => setPage(MatchPopupPage.LOBBY)}>
				<div className={b('center', { lobby: true })}>
					<UsersThree weight="fill" />
					<h2>{t('play.join_lobby')}</h2>
				</div>
			</button>
			<button className={b('option')} onClick={() => setPage(MatchPopupPage.CUSTOM_OPTIONS)}>
				<div className={b('center', { custom: true })}>
					<UserPlus weight="fill" />
					<h2>{t('play.create_new_game')}</h2>
				</div>
			</button>
		</div>
	);
}
