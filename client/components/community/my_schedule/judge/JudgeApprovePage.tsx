import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory, useLocation} from 'react-router-dom';
import block from '../../../../styles/bem';
import {useMe} from '../../../../util/hooks/useMe';
import AccountRequired from '../../../common/account_required/AccountRequired';
import {parseJudgeApproveToken} from '../../../../../shared/zkt_judge';
import JudgeApproval from './JudgeApproval';
import './Judge.scss';

const b = block('judge');

/**
 * /judge/approve?t=...: the address inside a judge's QR. The in-app reader
 * opens the same approval without coming here; this page is the fallback for a
 * QR read with the phone's own camera, which opens Zkt-Timer on the web.
 */
export default function JudgeApprovePage() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const me = useMe();
	const raw = new URLSearchParams(location.search).get('t') || '';
	// Checked with the same rule as the reader, against this page's own address.
	const token =
		typeof window !== 'undefined'
			? parseJudgeApproveToken(`${window.location.origin}/judge/approve?t=${encodeURIComponent(raw)}`, [window.location.host])
			: raw || null;

	let body: React.ReactNode;
	if (!me) {
		body = <AccountRequired descriptionKey="zkt_comp.judge_approve_account" />;
	} else if (!token) {
		body = <p className={b('notice', {error: true})}>{t('zkt_comp.judge_error_invalid_token')}</p>;
	} else {
		body = <JudgeApproval token={token} onDone={() => history.push('/competitions')} doneLabel={t('zkt_comp.judge_approve_close')} />;
	}

	return (
		<div className={b()}>
			<h2 className={b('title')}>{t('zkt_comp.judge_approve_title')}</h2>
			{body}
		</div>
	);
}
