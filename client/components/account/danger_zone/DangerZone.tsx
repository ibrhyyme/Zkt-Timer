import React from 'react';
import { gql } from '@apollo/client/core';
import { gqlMutate } from '../../api';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';

export default function DangerZone() {
	async function resetSettings() {
		const query = gql`
			mutation Mutate {
				resetSettings {
					id
				}
			}
		`;

		try {
			await gqlMutate(query);
			window.location.reload();
		} catch (e) {
			toastError(e.message);
		}
	}

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
			<div className="mb-8 border border-green-500/30 bg-green-500/10 rounded-xl p-6">
				<h3 className="text-xl font-bold text-green-400 mb-2">Ayarları Sıfırla</h3>
				<p className="text-gray-300 mb-4">
					Ayarlarınızı varsayılan değerlere sıfırlamak isterseniz bu seçeneği kullanabilirsiniz.
					Bu işlem çözümlerinizi veya oturumlarınızı <strong>silmez</strong>, sadece yerel ayarlarınızı sıfırlar.
				</p>
				<Button
					success
					text="Ayarları Sıfırla"
					confirmModalProps={{
						title: 'Ayarları Sıfırla',
						description: 'Ayarlarınızı varsayılan değerlere sıfırlamak üzeresiniz. Özel küp türleri etkilenmeyecek.',
						triggerAction: resetSettings,
						buttonText: 'Ayarları Sıfırla',
					}}
				/>
			</div>

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
