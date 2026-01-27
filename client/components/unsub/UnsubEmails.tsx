import React from 'react';
import './UnsubEmails.scss';
import AlertContainer from '../common/alert_container/AlertContainer';

export default function UnsubEmails() {
	const body = (
		<p>
			Artık tüm Zkt-Timer ipuçları, güncellemeleri ve pazarlama e-postalarından abonelikten çıktınız. <a href="/account/notifications">Bildirimler</a> sayfasından dilediğiniz zaman tekrar abone olabilirsiniz.
		</p>
	);

	return <AlertContainer fill body={body} type="success" />;
}
