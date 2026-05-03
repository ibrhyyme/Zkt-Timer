type SupportedLang = 'tr' | 'en' | 'es' | 'ru' | 'zh';

interface EmailStrings {
	greeting: string;
	code_expiry: string;
	closing: string;
	team: string;
	verification_subject: string;
	verification_message: string;
	forgot_subject: string;
	forgot_message: string;
	// Playful template strings
	forgot_title: string;
	forgot_intro: string;
	forgot_closing: string;
	forgot_expiry_minutes: number;
	verification_title: string;
	verification_intro: string;
	verification_closing: string;
	verification_expiry_minutes: number;
	code_label: string;
	expiry_text: string;
	footer_rights: string;
}

const emailTranslations: Record<SupportedLang, EmailStrings> = {
	tr: {
		greeting: 'Selam',
		code_expiry: 'Bu kod 30 dakika icinde gecerliligini yitirecektir.',
		closing: 'Sevgiler,',
		team: 'ZKT Timer Ekibi',
		verification_subject: 'ZKT Timer E-posta Doğrulama',
		verification_message: 'Hesabını doğrulamak için aşağıdaki kodu kullan.',
		forgot_subject: 'ZKT Timer Şifre Sıfırlama',
		forgot_message: 'Şifreni sıfırlamak için aşağıdaki kodu kullan.',
		forgot_title: 'Şifreni yeniliyoruz',
		forgot_intro: 'Selam <strong>{{name}}</strong>! Şifreni sıfırlamak istemişsin. Şu kodu uygulamaya yapıştır, kaldığın yerden çözmeye dön.',
		forgot_closing: "Hızlı solve'lar!",
		forgot_expiry_minutes: 15,
		verification_title: 'Hesabını aktifleştirelim',
		verification_intro: "Selam <strong>{{name}}</strong>! Aşağıdaki 6 haneli kodu uygulamaya gir, ilk solve'una <strong>1 adım</strong> uzaktasın.",
		verification_closing: 'Görüşmek üzere',
		verification_expiry_minutes: 30,
		code_label: 'TEK KULLANIMLIK KODUN',
		expiry_text: '{{minutes}} dakika sonra eriyecek',
		footer_rights: 'ZKT TIMER © 2026 Tüm hakları saklıdır.',
	},
	en: {
		greeting: 'Hi',
		code_expiry: 'This code will expire in 30 minutes.',
		closing: 'Best regards,',
		team: 'ZKT Timer Team',
		verification_subject: 'ZKT Timer Email Verification',
		verification_message: 'Use the code below to verify your account.',
		forgot_subject: 'ZKT Timer Password Reset',
		forgot_message: 'Use the code below to reset your password.',
		forgot_title: 'Refreshing your password',
		forgot_intro: 'Hi <strong>{{name}}</strong>! You asked to reset your password. Paste the code below into the app and pick up where you left off.',
		forgot_closing: 'Fast solves!',
		forgot_expiry_minutes: 15,
		verification_title: 'Activate your account',
		verification_intro: "Hi <strong>{{name}}</strong>! Enter the 6-digit code below in the app — you're <strong>1 step</strong> away from your first solve.",
		verification_closing: 'See you soon',
		verification_expiry_minutes: 30,
		code_label: 'YOUR ONE-TIME CODE',
		expiry_text: 'expires in {{minutes}} min',
		footer_rights: 'ZKT TIMER © 2026 All rights reserved.',
	},
	es: {
		greeting: 'Hola',
		code_expiry: 'Este código expirará en 30 minutos.',
		closing: 'Saludos,',
		team: 'Equipo ZKT Timer',
		verification_subject: 'Verificación de correo - ZKT Timer',
		verification_message: 'Usa el código a continuación para verificar tu cuenta.',
		forgot_subject: 'Restablecer contraseña - ZKT Timer',
		forgot_message: 'Usa el código a continuación para restablecer tu contraseña.',
		forgot_title: 'Renovamos tu contraseña',
		forgot_intro: 'Hola <strong>{{name}}</strong>! Pediste restablecer tu contraseña. Pega el código en la app y continúa donde lo dejaste.',
		forgot_closing: 'Solves rápidos!',
		forgot_expiry_minutes: 15,
		verification_title: 'Activa tu cuenta',
		verification_intro: 'Hola <strong>{{name}}</strong>! Ingresa el código de 6 dígitos en la app — estás a <strong>1 paso</strong> de tu primer solve.',
		verification_closing: 'Hasta pronto',
		verification_expiry_minutes: 30,
		code_label: 'TU CÓDIGO DE UN SOLO USO',
		expiry_text: 'expira en {{minutes}} min',
		footer_rights: 'ZKT TIMER © 2026 Todos los derechos reservados.',
	},
	ru: {
		greeting: 'Привет',
		code_expiry: 'Этот код истечёт через 30 минут.',
		closing: 'С уважением,',
		team: 'Команда ZKT Timer',
		verification_subject: 'Подтверждение почты - ZKT Timer',
		verification_message: 'Используй код ниже, чтобы подтвердить аккаунт.',
		forgot_subject: 'Сброс пароля - ZKT Timer',
		forgot_message: 'Используй код ниже, чтобы сбросить пароль.',
		forgot_title: 'Обновляем твой пароль',
		forgot_intro: 'Привет <strong>{{name}}</strong>! Ты запросил сброс пароля. Вставь код в приложение и продолжай с того места, где остановился.',
		forgot_closing: 'Быстрых solve!',
		forgot_expiry_minutes: 15,
		verification_title: 'Активируй аккаунт',
		verification_intro: 'Привет <strong>{{name}}</strong>! Введи 6-значный код в приложении — ты в <strong>1 шаге</strong> от первого solve.',
		verification_closing: 'До встречи',
		verification_expiry_minutes: 30,
		code_label: 'ТВОЙ ОДНОРАЗОВЫЙ КОД',
		expiry_text: 'истекает через {{minutes}} мин',
		footer_rights: 'ZKT TIMER © 2026 Все права защищены.',
	},
	zh: {
		greeting: '你好',
		code_expiry: '此验证码将在30分钟后失效。',
		closing: '此致，',
		team: 'ZKT Timer 团队',
		verification_subject: 'ZKT Timer 邮箱验证',
		verification_message: '使用下面的验证码来验证你的账户。',
		forgot_subject: 'ZKT Timer 密码重置',
		forgot_message: '使用下面的验证码来重置你的密码。',
		forgot_title: '为你更新密码',
		forgot_intro: '你好 <strong>{{name}}</strong>！你请求了重置密码。将验证码粘贴到应用中，从你离开的地方继续。',
		forgot_closing: '祝你快速还原！',
		forgot_expiry_minutes: 15,
		verification_title: '激活你的账户',
		verification_intro: '你好 <strong>{{name}}</strong>！在应用中输入6位验证码 — 距离你的第一次还原仅有 <strong>1 步</strong>。',
		verification_closing: '后会有期',
		verification_expiry_minutes: 30,
		code_label: '你的一次性验证码',
		expiry_text: '{{minutes}} 分钟后失效',
		footer_rights: 'ZKT TIMER © 2026 版权所有。',
	},
};

const SUPPORTED: SupportedLang[] = ['tr', 'en', 'es', 'ru', 'zh'];

export function getEmailStrings(lang?: string): EmailStrings {
	const resolved = SUPPORTED.find((s) => lang?.startsWith(s)) || 'en';
	return emailTranslations[resolved];
}

interface MailUser {
	email: string;
	first_name?: string;
}

export function buildForgotEmailData(user: MailUser, code: string, lang?: string) {
	const s = getEmailStrings(lang);
	const name = user.first_name || '';
	return {
		code,
		code_chars: code.split(''),
		title: s.forgot_title,
		intro: s.forgot_intro.replace('{{name}}', name),
		closing: s.forgot_closing,
		team: s.team,
		code_label: s.code_label,
		expiry_text: s.expiry_text.replace('{{minutes}}', String(s.forgot_expiry_minutes)),
		footer_rights: s.footer_rights,
	};
}

export function buildVerificationEmailData(user: MailUser, code: string, lang?: string) {
	const s = getEmailStrings(lang);
	const name = user.first_name || '';
	return {
		code,
		code_chars: code.split(''),
		title: s.verification_title,
		intro: s.verification_intro.replace('{{name}}', name),
		closing: s.verification_closing,
		team: s.team,
		code_label: s.code_label,
		expiry_text: s.expiry_text.replace('{{minutes}}', String(s.verification_expiry_minutes)),
		footer_rights: s.footer_rights,
	};
}
