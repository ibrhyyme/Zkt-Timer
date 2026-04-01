import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {toastError} from '../../../../util/toast';
import Button from '../../../common/button/Button';

const ADMIN_SEND_PUSH = gql`
	mutation AdminSendPushToUser($userId: String!, $title: String!, $body: String!) {
		adminSendPushToUser(userId: $userId, title: $title, body: $body) {
			success
		}
	}
`;

interface Props {
	userId: string;
	username: string;
	onClose?: () => void;
	onComplete?: () => void;
}

export default function SendPushModal({userId, username, onClose, onComplete}: Props) {
	const {t} = useTranslation();
	const [title, setTitle] = useState('');
	const [body, setBody] = useState('');
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);

	async function handleSend() {
		if (!title.trim() || !body.trim() || sending) return;

		setSending(true);
		try {
			await gqlMutate(ADMIN_SEND_PUSH, {userId, title: title.trim(), body: body.trim()});
			setSent(true);
		} catch (e) {
			toastError(e);
			setSending(false);
		}
	}

	if (sent) {
		return (
			<div style={{textAlign: 'center', padding: '16px 0'}}>
				<p style={{color: '#22c55e', fontWeight: 600}}>{t('admin_users.push_sent')}</p>
				<button
					onClick={onClose}
					style={{
						marginTop: '12px',
						padding: '6px 16px',
						borderRadius: '8px',
						fontSize: '0.85rem',
						border: '1px solid rgba(255,255,255,0.15)',
						backgroundColor: 'transparent',
						color: 'rgba(255,255,255,0.7)',
						cursor: 'pointer',
					}}
				>
					{t('solve_info.done')}
				</button>
			</div>
		);
	}

	return (
		<div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
			<p style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: 0}}>
				{username}
			</p>
			<div>
				<label style={{display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6px'}}>
					{t('admin_users.push_title')}
				</label>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					style={{
						width: '100%',
						padding: '8px 12px',
						backgroundColor: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.15)',
						borderRadius: '8px',
						color: '#fff',
						fontSize: '0.9rem',
						outline: 'none',
					}}
				/>
			</div>
			<div>
				<label style={{display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6px'}}>
					{t('admin_users.push_body')}
				</label>
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					style={{
						width: '100%',
						padding: '8px 12px',
						backgroundColor: 'rgba(255,255,255,0.06)',
						border: '1px solid rgba(255,255,255,0.15)',
						borderRadius: '8px',
						color: '#fff',
						fontSize: '0.9rem',
						height: '80px',
						resize: 'none',
						outline: 'none',
					}}
				/>
			</div>
			<Button
				fullWidth
				primary
				large
				text={sending ? t('admin_users.email_sending') : t('admin_users.send_push')}
				disabled={!title.trim() || !body.trim()}
				loading={sending}
				onClick={handleSend}
			/>
		</div>
	);
}
