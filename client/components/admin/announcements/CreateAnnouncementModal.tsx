import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {createPortal} from 'react-dom';
import {X, Translate, CircleNotch} from 'phosphor-react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import Checkbox from '../../common/checkbox/Checkbox';
import {toastError, toastSuccess} from '../../../util/toast';

const CREATE_ANNOUNCEMENT = gql`
	mutation CreateAnnouncement($input: CreateAnnouncementInput) {
		createAnnouncement(input: $input) {
			id
			title
		}
	}
`;

const UPDATE_ANNOUNCEMENT = gql`
	mutation UpdateAnnouncement($id: String!, $input: UpdateAnnouncementInput!) {
		updateAnnouncement(id: $id, input: $input) {
			id
			title
		}
	}
`;

const TRANSLATE_ANNOUNCEMENT = gql`
	mutation TranslateAnnouncementContent($title: String!, $content: String!) {
		translateAnnouncementContent(title: $title, content: $content) {
			title { en es ru zh }
			content { en es ru zh }
		}
	}
`;

const LANG_TABS = [
	{code: 'tr', label: 'TR'},
	{code: 'en', label: 'EN'},
	{code: 'es', label: 'ES'},
	{code: 'ru', label: 'RU'},
	{code: 'zh', label: 'ZH'},
] as const;

const PLATFORMS = [
	{key: 'WEB', label: 'Web'},
	{key: 'ANDROID', label: 'Android'},
	{key: 'IOS', label: 'iOS'},
] as const;

interface LangContent {
	title: string;
	content: string;
}

interface AnnouncementForEdit {
	id: string;
	title: string;
	content: string;
	category: string;
	priority: number;
	imageUrl?: string | null;
	targetUrl?: string | null;
	translations?: string | null;
	isDraft: boolean;
	isActive?: boolean;
}

interface CreateAnnouncementModalProps {
	onClose: () => void;
	announcement?: AnnouncementForEdit;  // varsa edit mode
}

function parseTranslations(raw?: string | null): Record<string, LangContent> {
	const empty = {
		en: {title: '', content: ''},
		es: {title: '', content: ''},
		ru: {title: '', content: ''},
		zh: {title: '', content: ''},
	};
	if (!raw) return empty;
	try {
		const parsed = JSON.parse(raw);
		return {
			en: {title: parsed.en?.title || '', content: parsed.en?.content || ''},
			es: {title: parsed.es?.title || '', content: parsed.es?.content || ''},
			ru: {title: parsed.ru?.title || '', content: parsed.ru?.content || ''},
			zh: {title: parsed.zh?.title || '', content: parsed.zh?.content || ''},
		};
	} catch {
		return empty;
	}
}

export default function CreateAnnouncementModal(props: CreateAnnouncementModalProps) {
	const {t} = useTranslation();
	const {onClose, announcement} = props;
	const isEdit = !!announcement;
	const [activeLang, setActiveLang] = useState('tr');
	const [formData, setFormData] = useState({
		title: announcement?.title || '',
		content: announcement?.content || '',
		category: announcement?.category || 'INFO',
		priority: announcement?.priority ?? 0,
		imageUrl: announcement?.imageUrl || '',
		targetUrl: announcement?.targetUrl || '',
		isDraft: announcement?.isDraft || false,
		isActive: announcement?.isActive ?? true,
		sendNotification: false,
		notificationPlatforms: ['WEB', 'ANDROID', 'IOS'] as string[],
	});
	const [translations, setTranslations] = useState<Record<string, LangContent>>(
		parseTranslations(announcement?.translations)
	);
	const [loading, setLoading] = useState(false);
	const [translating, setTranslating] = useState(false);
	const [error, setError] = useState('');

	const activeTitle = activeLang === 'tr' ? formData.title : translations[activeLang]?.title || '';
	const activeContent = activeLang === 'tr' ? formData.content : translations[activeLang]?.content || '';

	function updateLangField(field: 'title' | 'content', value: string) {
		if (activeLang === 'tr') {
			setFormData({...formData, [field]: value});
		} else {
			setTranslations({
				...translations,
				[activeLang]: {...translations[activeLang], [field]: value},
			});
		}
	}

	function buildTranslationsInput(): string | undefined {
		const hasAny = Object.values(translations).some((tr) => tr.title || tr.content);
		if (!hasAny) return undefined;

		const filtered: Record<string, LangContent> = {};
		for (const [lang, val] of Object.entries(translations)) {
			if (val.title || val.content) {
				filtered[lang] = val;
			}
		}
		return Object.keys(filtered).length > 0 ? JSON.stringify(filtered) : undefined;
	}

	function togglePlatform(platform: string) {
		const current = formData.notificationPlatforms;
		const next = current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform];
		setFormData({...formData, notificationPlatforms: next});
	}

	const handleTranslate = async () => {
		if (!formData.title.trim() || !formData.content.trim() || translating) return;
		setTranslating(true);
		try {
			const result = await gqlMutate(TRANSLATE_ANNOUNCEMENT, {
				title: formData.title,
				content: formData.content,
			});
			const data = result?.data?.translateAnnouncementContent;
			if (!data) throw new Error('Empty response');
			setTranslations({
				en: {title: data.title.en, content: data.content.en},
				es: {title: data.title.es, content: data.content.es},
				ru: {title: data.title.ru, content: data.content.ru},
				zh: {title: data.title.zh, content: data.content.zh},
			});
			toastSuccess(t('create_announcement.translate_success'));
		} catch (err) {
			console.error('[Translate] failed:', err);
			toastError(t('create_announcement.translate_error'));
		} finally {
			setTranslating(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			setLoading(true);
			setError('');
			if (isEdit && announcement) {
				await gqlMutate(UPDATE_ANNOUNCEMENT, {
					id: announcement.id,
					input: {
						title: formData.title,
						content: formData.content,
						category: formData.category,
						priority: parseInt(formData.priority.toString()),
						imageUrl: formData.imageUrl,
						targetUrl: formData.targetUrl.trim() || '',
						isDraft: formData.isDraft,
						isActive: formData.isActive,
						translations: buildTranslationsInput(),
					},
				});
			} else {
				await gqlMutate(CREATE_ANNOUNCEMENT, {
					input: {
						title: formData.title,
						content: formData.content,
						category: formData.category,
						priority: parseInt(formData.priority.toString()),
						imageUrl: formData.imageUrl,
						targetUrl: formData.targetUrl.trim() || undefined,
						isDraft: formData.isDraft,
						sendNotification: formData.sendNotification,
						notificationPlatforms: formData.sendNotification ? formData.notificationPlatforms : [],
						translations: buildTranslationsInput(),
					},
				});
			}
			onClose();
		} catch (err) {
			console.error('Failed to save announcement:', err);
			setError(t('create_announcement.error'));
		} finally {
			setLoading(false);
		}
	};

	const canTranslate = formData.title.trim().length > 0 && formData.content.trim().length > 0;

	const modal = (
		<div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
			<div
				className="bg-zinc-800 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="px-5 py-4 border-b border-zinc-700 flex justify-between items-center shrink-0">
					<h2 className="text-lg font-bold text-white">
						{isEdit ? t('create_announcement.edit_title') : t('create_announcement.title')}
					</h2>
					<button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded-lg transition">
						<X size={18} />
					</button>
				</div>

				{/* Scrollable Content */}
				<form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4">
					{/* Language Tabs */}
					<div className="flex gap-1 bg-zinc-900 p-1 rounded-lg mb-4">
						{LANG_TABS.map(({code, label}) => (
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

					{/* Title */}
					<div className="mb-3">
						<label className="block text-sm font-medium text-zinc-300 mb-1.5">
							{t('create_announcement.field_title')}
							{activeLang !== 'tr' && (
								<span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>
							)}
						</label>
						<input
							type="text"
							value={activeTitle}
							onChange={(e) => updateLangField('title', e.target.value)}
							className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
							required={activeLang === 'tr'}
							placeholder={
								activeLang !== 'tr'
									? formData.title || t('create_announcement.field_title')
									: ''
							}
						/>
					</div>

					{/* Category, Priority, Image - only on TR tab */}
					{activeLang === 'tr' && (
						<div className="grid grid-cols-2 gap-3 mb-3">
							<div>
								<label className="block text-sm font-medium text-zinc-300 mb-1.5">
									{t('create_announcement.field_category')}
								</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({...formData, category: e.target.value})}
									className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
								>
									<option value="FEATURE">{t('create_announcement.category_feature')}</option>
									<option value="BUGFIX">{t('create_announcement.category_bugfix')}</option>
									<option value="IMPORTANT">{t('create_announcement.category_important')}</option>
									<option value="INFO">{t('create_announcement.category_info')}</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-zinc-300 mb-1.5">
									{t('create_announcement.field_priority')}
								</label>
								<input
									type="number"
									min="0"
									max="10"
									value={formData.priority}
									onChange={(e) =>
										setFormData({...formData, priority: parseInt(e.target.value)})
									}
									className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
								/>
							</div>
						</div>
					)}

					{activeLang === 'tr' && (
						<div className="mb-3">
							<label className="block text-sm font-medium text-zinc-300 mb-1.5">
								{t('create_announcement.field_image_url')}
							</label>
							<input
								type="url"
								value={formData.imageUrl}
								onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
								placeholder="https://..."
							/>
						</div>
					)}

					{/* Content */}
					<div className="mb-3">
						<label className="block text-sm font-medium text-zinc-300 mb-1.5">
							{t('create_announcement.field_content')}
							{activeLang !== 'tr' && (
								<span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>
							)}
						</label>
						<textarea
							value={activeContent}
							onChange={(e) => updateLangField('content', e.target.value)}
							className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm h-36 font-mono placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none"
							required={activeLang === 'tr'}
							placeholder={
								activeLang !== 'tr'
									? formData.content?.substring(0, 100) ||
									  t('create_announcement.content_placeholder')
									: t('create_announcement.content_placeholder')
							}
						/>
					</div>

					{/* Translate button - only on TR tab */}
					{activeLang === 'tr' && (
						<div className="mb-4">
							<button
								type="button"
								onClick={handleTranslate}
								disabled={!canTranslate || translating}
								className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 disabled:bg-zinc-800 disabled:text-zinc-600 border border-violet-500/40 disabled:border-zinc-700 rounded-lg text-sm font-medium text-violet-300 disabled:cursor-not-allowed transition"
							>
								{translating ? (
									<>
										<CircleNotch size={16} weight="bold" className="animate-spin" />
										{t('create_announcement.translate_loading')}
									</>
								) : (
									<>
										<Translate size={16} weight="bold" />
										{t('create_announcement.translate_btn')}
									</>
								)}
							</button>
						</div>
					)}

					{/* Target URL - tab disinda, ortak alan, sadece TR'de goster */}
					{activeLang === 'tr' && (
						<div className="mb-3">
							<label className="block text-sm font-medium text-zinc-300 mb-1.5">
								{t('create_announcement.target_url_label')}
							</label>
							<input
								type="text"
								value={formData.targetUrl}
								onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
								placeholder={t('create_announcement.target_url_placeholder')}
							/>
						</div>
					)}

					{/* Draft + Notification Options - only on TR tab */}
					{activeLang === 'tr' && (
						<div className="space-y-2 mb-3">
							<Checkbox
								text={t('create_announcement.save_as_draft')}
								checked={formData.isDraft}
								onChange={(e) =>
									setFormData({
										...formData,
										isDraft: e.target.checked,
										sendNotification: false,
									})
								}
								noMargin
							/>

							{isEdit && (
								<Checkbox
									text={t('create_announcement.is_active')}
									checked={formData.isActive}
									onChange={(e) =>
										setFormData({...formData, isActive: e.target.checked})
									}
									noMargin
								/>
							)}

							{!isEdit && (
								<>
									<Checkbox
										text={t('create_announcement.send_notification')}
										checked={formData.sendNotification}
										disabled={formData.isDraft}
										onChange={(e) =>
											setFormData({...formData, sendNotification: e.target.checked})
										}
										noMargin
									/>

									{formData.isDraft && (
										<span className="text-xs text-zinc-500 block">
											{t('create_announcement.draft_notification_warning')}
										</span>
									)}

									{/* Platform Selection */}
									{formData.sendNotification && !formData.isDraft && (
										<div className="ml-6 mt-1 flex gap-3">
											{PLATFORMS.map(({key, label}) => {
												const selected = formData.notificationPlatforms.includes(key);
												return (
													<button
														key={key}
														type="button"
														onClick={() => togglePlatform(key)}
														className={`px-3 py-1 rounded-md text-sm font-medium transition ${
															selected
																? 'bg-blue-600 text-white'
																: 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
														}`}
													>
														{label}
													</button>
												);
											})}
										</div>
									)}
								</>
							)}
						</div>
					)}

					{/* Preview */}
					<div className="border border-zinc-700 rounded-lg p-4 bg-zinc-900/50 mt-2">
						<h3 className="text-sm font-semibold text-zinc-400 mb-3">
							{t('create_announcement.preview')}
							{activeLang !== 'tr' && (
								<span className="text-zinc-500 ml-1">({activeLang.toUpperCase()})</span>
							)}
						</h3>
						<div className="text-white">
							<h4 className="text-base font-bold mb-2">
								{activeTitle || t('create_announcement.field_title')}
							</h4>
							{formData.imageUrl && (
								<img
									src={formData.imageUrl}
									alt="Preview"
									className="rounded-lg mb-3 max-h-32 object-cover"
								/>
							)}
							<p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
								{activeContent || t('create_announcement.preview_content_placeholder')}
							</p>
						</div>
					</div>
				</form>

				{/* Footer */}
				<div className="px-5 py-3 border-t border-zinc-700 flex items-center gap-3 shrink-0">
					{error && <p className="text-red-400 text-sm mr-auto">{error}</p>}
					<div className="ml-auto flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 transition"
						>
							{t('create_announcement.cancel')}
						</button>
						<button
							onClick={handleSubmit}
							disabled={loading}
							className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
						>
							{loading
								? (isEdit ? t('create_announcement.updating') : t('create_announcement.creating'))
								: isEdit
								? t('create_announcement.update')
								: formData.isDraft
								? t('create_announcement.save_draft')
								: t('create_announcement.publish')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
