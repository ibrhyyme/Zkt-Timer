import React from 'react';
import { Lock } from 'phosphor-react';
import Button from '../../common/button/Button';
import Tag from '../../common/tag/Tag';

export default function DemoRestricted() {
	return (
		<div className="mx-auto mt-16 mb-3 w-full max-w-md rounded-lg bg-module py-10 px-6">
			<div className="mx-auto flex flex-col items-center">
				<span className="mb-3 text-xl text-red-500">
					<Lock weight="fill" />
				</span>
				<Tag text="KISITLI ERİŞİM" bold small backgroundColor="red" textColor="white" />
			</div>
			<div className="my mt-6 mb-10 text-center font-label text-xl text-text/70">
				Bu sayfa demo modunda kullanılamaz. Erişim için lütfen giriş yapın veya ücretsiz hesap oluşturun.
			</div>
			<div className="mx-auto flex flex-row justify-center gap-3">
				<Button large glow to="/login" text="Giriş Yap" />
				<Button large glow to="/signup" text="Kayıt Ol" primary />
			</div>
		</div>
	);
}
