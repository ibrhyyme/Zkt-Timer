import { Resend } from 'resend';
import path from 'path'
import fs from 'fs';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { createEmailLog } from '../models/email_log';
import { UserAccount } from '../schemas/UserAccount.schema';

// Resend client initialization
const resend = new Resend(process.env.RESEND_API_KEY);

type MjmlTemplate = {
	[key: string]: string
}
const mjmlTemplates: MjmlTemplate = {};

type EmailTemplateVars = {
	[key: string]: any
}

export function initMjmlTemplates(): void {
	const directoryPath = path.join(__dirname, '/../resources/mjml_templates');

	fs.readdirSync(directoryPath).forEach((file: string) => {
		const body = fs.readFileSync(directoryPath + '/' + file);
		const fileName = file.replace('.mjml', '');

		mjmlTemplates[fileName] = mjml2html(String(body)).html;
	});
}

export async function sendEmailWithTemplate(user: UserAccount, subject: string, template: string, vars: EmailTemplateVars): Promise<any> {
	let variables = vars || {};
	const source = mjmlTemplates[template];

	variables = {
		user,
		...variables
	}

	const templateBody = Handlebars.compile(source);
	const body = templateBody(variables);

	await createEmailLog(user, subject, template, vars);

	return sendEmail(user.email, subject, body);
}

async function sendEmail(email: string, subject: string, body: string) {
	let content = body;
	if (Array.isArray(body)) {
		content = body.join('<br/>');
	}

	try {
		const data = await resend.emails.send({
			from: 'Zkt-Timer <noreply@zktimer.app>',
			to: [email],
			subject: subject,
			html: content,
		});

		return data;
	} catch (error) {
		console.error('Error sending email with Resend:', error);
		throw error;
	}
}
