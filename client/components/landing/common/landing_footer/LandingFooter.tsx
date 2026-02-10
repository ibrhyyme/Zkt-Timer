import React from 'react';
import './LandingFooter.scss';
import block from '../../../../styles/bem';

const b = block('landing-footer');

export default function LandingFooter() {
	return (
		<div className={b()}>
			<ul>
				<li>
					<a href="mailto:ibrhyyme@icloud.com">Destek (E-posta)</a>
				</li>
				<li>
					<a href="/terms">Kullanıcı Sözleşmesi</a>
				</li>
				<li>
					<a href="/credits">Teşekkürler (Credits)</a>
				</li>
				<li>
					<a href="/privacy">Gizlilik Politikası</a>
				</li>
			</ul>
		</div>
	);
}
