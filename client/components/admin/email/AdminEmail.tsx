import React, { useState } from 'react';
import './AdminEmail.scss';
import { X, PaperPlaneRight, UsersThree, EnvelopeSimple, WarningCircle, Check } from 'phosphor-react';
import { gql } from '@apollo/client';
import { gqlMutateTyped } from '../../api';
import RecipientSelector, { SelectedUser } from './RecipientSelector';
import { useTranslation } from 'react-i18next';

const SEND_BULK_EMAIL_MUTATION = gql`
	mutation SendBulkEmail($input: SendBulkEmailInput!) {
		sendBulkEmail(input: $input) {
			successCount
			failCount
		}
	}
`;

interface BulkEmailResult {
	successCount: number;
	failCount: number;
}

export default function AdminEmail() {
	const { t } = useTranslation();
	const [recipients, setRecipients] = useState<Map<string, SelectedUser>>(new Map());
	const [sendToAll, setSendToAll] = useState(false);
	const [subject, setSubject] = useState('');
	const [content, setContent] = useState('');
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<BulkEmailResult | null>(null);
	const [error, setError] = useState('');
	const [showSelector, setShowSelector] = useState(false);

	const recipientList = Array.from(recipients.values());
	const canSend = (sendToAll || recipientList.length > 0) && subject.trim() && content.trim();

	const handleRemoveRecipient = (id: string) => {
		const newMap = new Map(recipients);
		newMap.delete(id);
		setRecipients(newMap);
	};

	const handleSend = async () => {
		if (!canSend) return;

		const recipientCount = sendToAll ? t('admin_email.to_all_users') : recipientList.length;
		if (!confirm(t('admin_email.send_confirm', { count: recipientCount }))) {
			return;
		}

		setSending(true);
		setError('');
		setResult(null);

		try {
			const res = await gqlMutateTyped(SEND_BULK_EMAIL_MUTATION, {
				input: {
					userIds: sendToAll ? [] : recipientList.map((u) => u.id),
					sendToAll,
					subject: subject.trim(),
					content: content.trim(),
				},
			});

			if (res.data?.sendBulkEmail) {
				setResult(res.data.sendBulkEmail);
			}
		} catch (err) {
			console.error('Failed to send bulk email:', err);
			setError(t('admin_email.send_error'));
		} finally {
			setSending(false);
		}
	};

	const handleReset = () => {
		setRecipients(new Map());
		setSendToAll(false);
		setSubject('');
		setContent('');
		setResult(null);
		setError('');
	};

	return (
		<div className="p-8 max-w-7xl mx-auto">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-white mb-2">{t('admin_email.page_title')}</h1>
				<p className="text-gray-400">{t('admin_email.subtitle')}</p>
			</div>

			{/* Result Banner */}
			{result && (
				<div className="mb-6 p-4 rounded-xl border bg-[#1e1e24] border-white/5">
					<div className="flex items-center gap-3 mb-2">
						<EnvelopeSimple size={22} className="text-green-400" weight="bold" />
						<h3 className="font-semibold text-white">{t('admin_email.send_complete')}</h3>
					</div>
					<div className="flex gap-6 text-sm">
						<span className="text-green-400">
							{t('admin_email.success_count', { count: result.successCount })}
						</span>
						{result.failCount > 0 && (
							<span className="text-red-400">
								{t('admin_email.fail_count', { count: result.failCount })}
							</span>
						)}
					</div>
					<button
						onClick={handleReset}
						className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition"
					>
						{t('admin_email.new_email')}
					</button>
				</div>
			)}

			{/* Main Content */}
			<div className="bg-[#1e1e24] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
				{/* Recipients Section */}
				<div className="p-6 border-b border-white/5">
					<label className="block text-sm font-medium text-gray-300 mb-3">{t('admin_email.recipients')}</label>

					<div className="flex items-center gap-4 mb-3 flex-wrap">
						<div
							onClick={() => setSendToAll(!sendToAll)}
							className="flex items-center gap-2 cursor-pointer select-none"
						>
							<div
								className={`w-4 h-4 rounded border flex items-center justify-center transition ${
									sendToAll
										? 'bg-blue-500 border-blue-500'
										: 'border-zinc-500 bg-zinc-900'
								}`}
							>
								{sendToAll && <Check size={12} weight="bold" className="text-white" />}
							</div>
							<span className="text-sm text-gray-300">{t('admin_email.send_to_all')}</span>
						</div>
					</div>

					{!sendToAll && (
						<>
							{recipientList.length > 0 && (
								<div className="flex flex-wrap gap-2 mb-3">
									{recipientList.slice(0, 20).map((user) => (
										<span
											key={user.id}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-gray-300"
										>
											{user.username || user.email}
											<button
												onClick={() => handleRemoveRecipient(user.id)}
												className="hover:text-red-400 transition"
											>
												<X size={14} />
											</button>
										</span>
									))}
									{recipientList.length > 20 && (
										<span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-gray-500">
											{t('admin_email.more_recipients', { count: recipientList.length - 20 })}
										</span>
									)}
								</div>
							)}

							<button
								onClick={() => setShowSelector(true)}
								className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-gray-300 hover:bg-zinc-700 hover:text-white transition"
							>
								<UsersThree size={18} />
								{t('admin_email.add_person')}
							</button>
						</>
					)}
				</div>

				{/* Subject */}
				<div className="p-6 border-b border-white/5">
					<label className="block text-sm font-medium text-gray-300 mb-2">{t('admin_email.subject')}</label>
					<input
						type="text"
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
						placeholder={t('admin_email.subject_placeholder')}
						className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
					/>
				</div>

				{/* Content + Preview */}
				<div className="p-6 grid grid-cols-2 gap-6">
					{/* Left - Content */}
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-2">{t('admin_email.content')}</label>
						<textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder={t('admin_email.content_placeholder')}
							className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none font-mono text-sm"
							style={{ minHeight: '350px' }}
						/>
						{/* Tips */}
						<div className="mt-3 space-y-1.5">
							<p className="text-xs text-gray-500 flex items-center gap-1.5">
								<WarningCircle size={12} />
								{t('admin_email.tip_subject')}
							</p>
							<p className="text-xs text-gray-500 flex items-center gap-1.5">
								<WarningCircle size={12} />
								{t('admin_email.tip_links')}
							</p>
						</div>
					</div>

					{/* Right - Preview */}
					<div>
						<label className="block text-sm font-medium text-gray-300 mb-2">{t('admin_email.preview')}</label>
						<div className="border border-zinc-700 rounded-lg bg-white p-6 overflow-y-auto" style={{ minHeight: '350px' }}>
							{/* Email Preview */}
							<div style={{ fontFamily: 'helvetica, arial, sans-serif', maxWidth: '500px', margin: '0 auto' }}>
								<div style={{ textAlign: 'center', marginBottom: '16px' }}>
									<div style={{ width: '60px', height: '60px', margin: '0 auto', backgroundColor: '#246bfd', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
										<EnvelopeSimple size={28} color="#fff" weight="bold" />
									</div>
								</div>
								<div style={{ borderTop: '2px solid #444', paddingTop: '16px', marginBottom: '12px' }} />
								<p style={{ fontSize: '20px', color: '#444', marginBottom: '16px' }}>
									{t('admin_email.email_greeting')}
								</p>
								<div style={{ fontSize: '20px', color: '#444', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
									{content || t('admin_email.content_preview_placeholder')}
								</div>
								<p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
									<a href="https://zktimer.app" style={{ color: '#246bfd', textDecoration: 'underline' }}>{t('admin_email.go_to_zkttimer')}</a>
								</p>
								<div style={{ borderTop: '2px solid #444', paddingTop: '12px', marginTop: '20px' }}>
									<p style={{ fontSize: '20px', color: '#444', marginBottom: '4px' }}>{t('admin_email.regards')}</p>
									<p style={{ fontSize: '20px', color: '#444', fontWeight: 'bold' }}>{t('admin_email.team')}</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Footer / Actions */}
				<div className="p-6 border-t border-white/5 flex items-center justify-between">
					<div>
						{error && (
							<p className="text-sm text-red-400">{error}</p>
						)}
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={handleReset}
							className="px-4 py-2 border border-zinc-700 rounded-lg text-sm text-gray-300 hover:bg-zinc-700 transition"
						>
							{t('admin_email.clear')}
						</button>
						<button
							onClick={handleSend}
							disabled={!canSend || sending}
							className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{sending ? (
								<>
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
									{t('admin_email.sending')}
								</>
							) : (
								<>
									<PaperPlaneRight size={18} weight="bold" />
									{t('admin_email.send_button')}
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Recipient Selector Modal */}
			{showSelector && (
				<RecipientSelector
					selectedUsers={recipients}
					onConfirm={(users) => {
						setRecipients(users);
						setShowSelector(false);
					}}
					onClose={() => setShowSelector(false)}
				/>
			)}
		</div>
	);
}
