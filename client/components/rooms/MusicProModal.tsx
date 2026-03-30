import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { closeModal } from '../../actions/general';
import { MusicNote, YoutubeLogo, Users, Headphones } from 'phosphor-react';

export default function MusicProModal() {
	const { t } = useTranslation();
	const history = useHistory();
	const dispatch = useDispatch();

	function handleUpgrade() {
		dispatch(closeModal());
		history.push('/account/pro');
	}

	return (
		<div className="p-8 max-w-sm mx-auto text-center">
			<div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
				<MusicNote size={40} weight="fill" className="text-white" />
			</div>

			<h2 className="text-2xl font-bold text-white mb-3">
				{t('pro.music_title')}
			</h2>
			<p className="text-base text-white opacity-70 mb-7">
				{t('pro.music_description')}
			</p>

			<div className="flex flex-col gap-4 mb-7 text-left">
				<div className="flex items-center gap-4 p-4 rounded-lg bg-[color:var(--primary-color)]/10">
					<YoutubeLogo size={28} weight="fill" className="text-red-500 shrink-0" />
					<span className="text-base text-white">{t('pro.music_youtube')}</span>
				</div>
				<div className="flex items-center gap-4 p-4 rounded-lg bg-[color:var(--primary-color)]/10">
					<Users size={28} weight="fill" className="text-blue-400 shrink-0" />
					<span className="text-base text-white">{t('pro.music_friends')}</span>
				</div>
				<div className="flex items-center gap-4 p-4 rounded-lg bg-[color:var(--primary-color)]/10">
					<Headphones size={28} weight="fill" className="text-green-400 shrink-0" />
					<span className="text-base text-white">{t('pro.music_unlimited')}</span>
				</div>
			</div>

			<button
				type="button"
				onClick={handleUpgrade}
				className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-base cursor-pointer hover:opacity-90 transition-opacity"
			>
				{t('pro.upgrade_button')}
			</button>
		</div>
	);
}
