import React, { useState } from 'react';
import {useTranslation} from 'react-i18next';
import { createPortal } from 'react-dom';
import { X } from 'phosphor-react';
import { gql } from '@apollo/client';
import { gqlMutate } from '../../api';
import Checkbox from '../../common/checkbox/Checkbox';

const CREATE_ANNOUNCEMENT = gql`
	mutation CreateAnnouncement($input: CreateAnnouncementInput) {
		createAnnouncement(input: $input) {
			id
			title
		}
	}
`;

const LANG_TABS = [
	{ code: 'tr', label: 'TR' },
	{ code: 'en', label: 'EN' },
	{ code: 'es', label: 'ES' },
	{ code: 'ru', label: 'RU' },
] as const;

interface LangContent {
	title: string;
	content: string;
}

interface CreateAnnouncementModalProps {
	onClose: () => void;
}

export default function CreateAnnouncementModal(props: CreateAnnouncementModalProps) {
	const {t} = useTranslation();
	const { onClose } = props;
	const [activeLang, setActiveLang] = useState('tr');
	const [formData, setFormData] = useState({
		title: '',
		content: '',
		category: 'INFO',
		priority: 0,
		imageUrl: '',
		isDraft: false,
		sendNotification: false
	});
	const [translations, setTranslations] = useState<Record<string, LangContent>>({
		en: { title: '', content: '' },
		es: { title: '', content: '' },
		ru: { title: '', content: '' },
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const activeTitle = activeLang === 'tr' ? formData.title : translations[activeLang]?.title || '';
	const activeContent = activeLang === 'tr' ? formData.content : translations[activeLang]?.content || '';

	function updateLangField(field: 'title' | 'content', value: string) {
		if (activeLang === 'tr') {
			setFormData({ ...formData, [field]: value });
		} else {
			setTranslations({
				...translations,
				[activeLang]: { ...translations[activeLang], [field]: value }
			});
		}
	}

	function buildTranslationsInput(): string | undefined {
		const hasAny = Object.values(translations).some(t => t.title || t.content);
		if (!hasAny) return undefined;

		// Sadece doldurulmuş dilleri gönder
		const filtered: Record<string, LangContent> = {};
		for (const [lang, val] of Object.entries(translations)) {
			if (val.title || val.content) {
				filtered[lang] = val;
			}
		}
		return Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : undefined;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			setLoading(true);
			setError('');
			await gqlMutate(CREATE_ANNOUNCEMENT, {
				input: {
					...formData,
					priority: parseInt(formData.priority.toString()),
					translations: buildTranslationsInput()
				}
			});
			onClose();
		} catch (err) {
			console.error('Failed to create announcement:', err);
			setError(t('create_announcement.error'));
		} finally {
			setLoading(false);
		}
	};

	const modal = (
		<div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60">
			<div className="bg-zinc-800 border border-zinc-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
				<div className="p-6 border-b border-zinc-700 flex justify-between items-center">
					<h2 className="text-xl font-bold">{t('create_announcement.title')}</h2>
					<button onClick={onClose} className="p-2 hover:bg-zinc-700 rounded">
						<X size={20} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-160px)]">
					<div className="p-6 grid grid-cols-2 gap-6">
						{/* Left - Form */}
						<div className="space-y-4">
							{/* Language Tabs */}
							<div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
								{LANG_TABS.map(({ code, label }) => (
									<button
										key={code}
										type="button"
										onClick={() => setActiveLang(code)}
										className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition ${
											activeLang === code
												? 'bg-blue-600 text-white'
												: 'text-zinc-400 hover:text-white hover:bg-zinc-700'
										}`}
									>
										{label}
										{code === 'tr' && ' *'}
									</button>
								))}
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">
									{t('create_announcement.field_title')}
									{activeLang !== 'tr' && <span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>}
								</label>
								<input
									type="text"
									value={activeTitle}
									onChange={(e) => updateLangField('title', e.target.value)}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
									required={activeLang === 'tr'}
									placeholder={activeLang !== 'tr' ? formData.title || t('create_announcement.field_title') : ''}
								/>
							</div>

							{activeLang === 'tr' && (
								<>
									<div>
										<label className="block text-sm font-medium mb-2">{t('create_announcement.field_category')}</label>
										<select
											value={formData.category}
											onChange={(e) => setFormData({ ...formData, category: e.target.value })}
											className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
										>
											<option value="FEATURE">{t('create_announcement.category_feature')}</option>
											<option value="BUGFIX">{t('create_announcement.category_bugfix')}</option>
											<option value="IMPORTANT">{t('create_announcement.category_important')}</option>
											<option value="INFO">{t('create_announcement.category_info')}</option>
										</select>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">{t('create_announcement.field_priority')}</label>
										<input
											type="number"
											min="0"
											max="10"
											value={formData.priority}
											onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
											className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">{t('create_announcement.field_image_url')}</label>
										<input
											type="url"
											value={formData.imageUrl}
											onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
											className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
											placeholder="https://..."
										/>
									</div>
								</>
							)}

							<div>
								<label className="block text-sm font-medium mb-2">
									{t('create_announcement.field_content')}
									{activeLang !== 'tr' && <span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>}
								</label>
								<textarea
									value={activeContent}
									onChange={(e) => updateLangField('content', e.target.value)}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg h-64 font-mono text-sm"
									required={activeLang === 'tr'}
									placeholder={activeLang !== 'tr' ? formData.content?.substring(0, 100) || t('create_announcement.content_placeholder') : t('create_announcement.content_placeholder')}
								/>
							</div>

							{activeLang === 'tr' && (
								<>
									<Checkbox
										text={t('create_announcement.save_as_draft')}
										checked={formData.isDraft}
										onChange={(e) => setFormData({ ...formData, isDraft: e.target.checked, sendNotification: false })}
										noMargin
									/>

									<Checkbox
										text={t('create_announcement.send_notification')}
										checked={formData.sendNotification}
										disabled={formData.isDraft}
										onChange={(e) => setFormData({ ...formData, sendNotification: e.target.checked })}
										noMargin
									/>
									{formData.isDraft && (
										<span className="text-xs text-zinc-500 -mt-1">{t('create_announcement.draft_notification_warning')}</span>
									)}
								</>
							)}
						</div>

						{/* Right - Live Preview */}
						<div className="border border-zinc-700 rounded-lg p-4 bg-zinc-900">
							<h3 className="font-semibold mb-4">
								{t('create_announcement.preview')}
								{activeLang !== 'tr' && <span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>}
							</h3>
							<div className="prose prose-invert prose-sm max-w-none">
								<h4>{activeTitle || t('create_announcement.field_title')}</h4>
								{formData.imageUrl && (
									<img src={formData.imageUrl} alt="Preview" className="rounded-lg mb-4" />
								)}
								<div className="whitespace-pre-wrap">
									{activeContent || t('create_announcement.content_preview_placeholder')}
								</div>
							</div>
						</div>
					</div>
				</form>

				<div className="p-6 border-t border-zinc-700 flex justify-end gap-3">
					{error && <p className="text-red-400 text-sm mr-auto">{error}</p>}
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition"
					>
						{t('create_announcement.cancel')}
					</button>
					<button
						onClick={handleSubmit}
						disabled={loading}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
					>
						{loading ? t('create_announcement.creating') : formData.isDraft ? t('create_announcement.save_draft') : t('create_announcement.publish')}
					</button>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
