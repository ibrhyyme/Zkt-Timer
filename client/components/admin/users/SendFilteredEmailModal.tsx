import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {createPortal} from 'react-dom';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {toastError} from '../../../util/toast';

const SEND_BULK_EMAIL = gql`
	mutation SendBulkEmail($input: SendBulkEmailInput!) {
		sendBulkEmail(input: $input) {
			successCount
			failCount
		}
	}
`;

interface User {
	id: string;
	username: string;
	email: string;
}

interface Props {
	users: User[];
	onClose: () => void;
}

export default function SendFilteredEmailModal({users, onClose}: Props) {
	const {t} = useTranslation();
	const [subject, setSubject] = useState('');
	const [content, setContent] = useState('');
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);

	async function handleSend() {
		if (!subject.trim() || !content.trim() || sending) return;

		setSending(true);
		try {
			await gqlMutate(SEND_BULK_EMAIL, {
				input: {
					userIds: users.map((u) => u.id),
					sendToAll: false,
					subject: subject.trim(),
					content: content.trim(),
				},
			});
			setSent(true);
		} catch (e) {
			toastError(e);
			setSending(false);
		}
	}

	return createPortal(
		<div
			className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60"
			onClick={onClose}
		>
			<div
				className="bg-zinc-800 border border-zinc-700 rounded-xl w-full max-w-lg overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="px-5 py-4 border-b border-zinc-700">
					<h2 className="text-lg font-bold text-white">{t('admin_users.send_email_filtered')}</h2>
					<p className="text-sm text-zinc-400 mt-1">
						{t('admin_users.recipients_count', {count: users.length})}
					</p>
				</div>

				{sent ? (
					<div className="p-8 text-center">
						<p className="text-green-400 font-semibold">{t('admin_users.email_sent')}</p>
						<button
							onClick={onClose}
							className="mt-4 px-4 py-2 bg-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-600 transition"
						>
							{t('solve_info.done')}
						</button>
					</div>
				) : (
					<div className="p-5 space-y-3">
						<div>
							<label className="block text-sm font-medium text-zinc-300 mb-1.5">
								{t('admin_users.email_subject')}
							</label>
							<input
								type="text"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-zinc-300 mb-1.5">
								{t('admin_users.email_content')}
							</label>
							<textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm h-32 resize-none focus:border-blue-500 focus:outline-none"
							/>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<button
								onClick={onClose}
								className="px-4 py-2 text-sm border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-700 transition"
							>
								{t('create_announcement.cancel')}
							</button>
							<button
								onClick={handleSend}
								disabled={!subject.trim() || !content.trim() || sending}
								className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
							>
								{sending ? t('admin_users.email_sending') : t('admin_users.send_email_filtered')}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>,
		document.body
	);
}
