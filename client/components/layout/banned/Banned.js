import React from 'react';
import { connect } from 'react-redux';
import { Warning } from 'phosphor-react';
import './Banned.scss';
import { getDateFromNow } from '../../../util/dates';
import Button from '../../common/button/Button';
import { logOut } from '../../../util/auth/logout';

class Banned extends React.Component {
	render() {
		const { me } = this.props;

		let bannedText;

		if (me.banned_forever) {
			bannedText = (
				<p>
					Hesabınız <span>kalıcı olarak</span> yasaklandı
				</p>
			);
		} else {
			const until = getDateFromNow(me.banned_until);
			bannedText = (
				<p>
					Yasak <span>{until}</span> tarihinde otomatik olarak kaldırılacak
				</p>
			);
		}

		let reason;
		if (me.bans && me.bans.length) {
			const ban = me.bans[0];
			reason = ban.reason;
		} else {
			reason = <i>Sebep belirtilmedi</i>;
		}

		return (
			<div className="cd-banned">
				<div className="cd-banned__body">
					<Warning weight="bold" />
					<h4>Hesap Yasaklandı</h4>
					{bannedText}
					<div className="cd-banned__body__reason">
						<span>Sebep</span>
						<p>{reason}</p>
					</div>
					<p>
						Bunun bir hata olduğunu düşünüyorsanız lütfen iletişime geçin:{' '}
						<a href="mailto:ibrhyyme@icloud.com">ibrhyyme@icloud.com</a>
					</p>
					<Button text="Çıkış yap" onClick={logOut} />
				</div>
			</div>
		);
	}
}

export default connect((store) => ({
	me: store.account.me,
}))(Banned);
