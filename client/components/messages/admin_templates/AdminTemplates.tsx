import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Lightning, X} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {useMe} from '../../../util/hooks/useMe';
import './AdminTemplates.scss';

const b = block('admin-templates');

/** Keys under admin_templates.items in the translation files, in menu order. */
const TEMPLATE_KEYS = ['thanks', 'feedback', 'fixed', 'new_feature', 'review', 'record'] as const;
const LANGUAGES = ['tr', 'en', 'es', 'ru', 'zh'] as const;

interface Props {
	/** Fills {{username}} in the template. */
	username: string;
	/** Puts the chosen text into the composer; the admin still reads it and presses send. */
	onPick: (text: string) => void;
	/** The floating bubble window: a smaller trigger and panel. */
	compact?: boolean;
}

/**
 * Ready-made messages for an admin writing to a member. Admins only: everyone else gets
 * nothing rendered. The language row lets the admin answer a member in that member's
 * language without switching the whole app.
 */
export default function AdminTemplates({username, onPick, compact}: Props) {
	const {t, i18n} = useTranslation();
	const me = useMe();
	const [open, setOpen] = useState(false);
	const [lang, setLang] = useState<string>(() =>
		(LANGUAGES as readonly string[]).includes(i18n.language) ? i18n.language : 'en'
	);

	if (!me?.admin) return null;

	const tl = i18n.getFixedT(lang);

	return (
		<>
			{/* Full size matches the composer's other gray buttons; the bubble has no room for them. */}
			{compact ? (
				<button
					type="button"
					className={b('trigger')}
					title={t('admin_templates.button')}
					aria-label={t('admin_templates.button')}
					aria-expanded={open}
					onClick={() => setOpen(!open)}
				>
					<Lightning weight="bold" />
				</button>
			) : (
				<Button
					gray
					title={t('admin_templates.button')}
					icon={<Lightning weight="bold" />}
					onClick={() => setOpen(!open)}
				/>
			)}
			{open && (
				<div className={b({compact})} role="dialog" aria-label={t('admin_templates.title')}>
					<div className={b('head')}>
						<span className={b('title')}>{t('admin_templates.title')}</span>
						<button
							type="button"
							className={b('close')}
							aria-label={t('messages.close')}
							onClick={() => setOpen(false)}
						>
							<X weight="bold" />
						</button>
					</div>
					<div className={b('langs')}>
						{LANGUAGES.map((code) => (
							<button
								key={code}
								type="button"
								className={b('lang', {active: lang === code})}
								onClick={() => setLang(code)}
							>
								{code.toUpperCase()}
							</button>
						))}
					</div>
					<div className={b('list')}>
						{TEMPLATE_KEYS.map((key) => {
							const text = tl(`admin_templates.items.${key}.text`, {username}) as string;
							return (
								<button
									key={key}
									type="button"
									className={b('row')}
									onClick={() => {
										onPick(text);
										setOpen(false);
									}}
								>
									<span className={b('label')}>{tl(`admin_templates.items.${key}.label`)}</span>
									<span className={b('preview')}>{text}</span>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</>
	);
}
