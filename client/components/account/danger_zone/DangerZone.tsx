import React from 'react';
import {gql} from '@apollo/client/core';
import {gqlMutate} from '../../api';
import Button from '../../common/button/Button';

export default function DangerZone() {
	async function deleteAccount() {
		const query = gql`
			mutation Mutate {
				deleteUserAccount {
					id
				}
			}
		`;

		await gqlMutate(query);
		window.location.href = '/';
	}

	return (
		<div>
			<p>
				Burada dikkatli olun. Aşağıdaki butona tıklarssanız, tüm hesabınızı sileceksiniz. Tüm çözümleriniz,
				seans bilgileriniz, istatistikleriniz vb. sonsuza kadar silinecek. Dikkatli ilerleyin.
			</p>
			<Button
				danger
				large
				glow
				text="Hesabı Sil"
				confirmModalProps={{
					title: 'Hesabı sil',
					description:
						"Burada dikkatli olun. Tüm hesabınızı silmek üzeresiniz. Tüm Zkt-Timer verileriniz silinecek ve kurtarılamayacak.",
					triggerAction: deleteAccount,
					buttonText: 'Hesabı ve tüm verileri sil',
				}}
			/>
		</div>
	);
}
