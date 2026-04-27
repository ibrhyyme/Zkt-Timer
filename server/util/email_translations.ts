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
}

const emailTranslations: Record<SupportedLang, EmailStrings> = {
	tr: {
		greeting: 'Merhaba',
		code_expiry: 'Bu kod 30 dakika icinde gecerliligini yitirecektir.',
		closing: 'Sevgiler,',
		team: 'Zkt Timer Ekibi',
		verification_subject: 'Zkt Timer E-posta Doğrulama',
		verification_message: 'Hesabınızı doğrulamak için lütfen aşağıdaki kodu kullanın:',
		forgot_subject: 'Zkt Timer Şifre Sıfırlama',
		forgot_message: 'Şifrenizi sıfırlamak için lütfen aşağıdaki kodu kullanın:',
	},
	en: {
		greeting: 'Hello',
		code_expiry: 'This code will expire in 30 minutes.',
		closing: 'Best regards,',
		team: 'Zkt Timer Team',
		verification_subject: 'Zkt Timer Email Verification',
		verification_message: 'Please use the following code to verify your account:',
		forgot_subject: 'Zkt Timer Password Reset',
		forgot_message: 'Please use the following code to reset your password:',
	},
	es: {
		greeting: 'Hola',
		code_expiry: 'Este código expirará en 30 minutos.',
		closing: 'Saludos,',
		team: 'Equipo Zkt Timer',
		verification_subject: 'Verificación de correo - Zkt Timer',
		verification_message: 'Por favor, usa el siguiente código para verificar tu cuenta:',
		forgot_subject: 'Restablecer contraseña - Zkt Timer',
		forgot_message: 'Por favor, usa el siguiente código para restablecer tu contraseña:',
	},
	ru: {
		greeting: 'Привет',
		code_expiry: 'Этот код истечёт через 30 минут.',
		closing: 'С уважением,',
		team: 'Команда Zkt Timer',
		verification_subject: 'Подтверждение почты - Zkt Timer',
		verification_message: 'Пожалуйста, используйте следующий код для подтверждения аккаунта:',
		forgot_subject: 'Сброс пароля - Zkt Timer',
		forgot_message: 'Пожалуйста, используйте следующий код для сброса пароля:',
	},
	zh: {
		greeting: '你好',
		code_expiry: '此验证码将在30分钟后失效。',
		closing: '此致，',
		team: 'Zkt Timer 团队',
		verification_subject: 'Zkt Timer 邮箱验证',
		verification_message: '请使用以下验证码验证您的账户：',
		forgot_subject: 'Zkt Timer 密码重置',
		forgot_message: '请使用以下验证码重置您的密码：',
	},
};

const SUPPORTED: SupportedLang[] = ['tr', 'en', 'es', 'ru', 'zh'];

export function getEmailStrings(lang?: string): EmailStrings {
	const resolved = SUPPORTED.find((s) => lang?.startsWith(s)) || 'en';
	return emailTranslations[resolved];
}
