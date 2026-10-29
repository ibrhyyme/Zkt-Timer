import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinkSimple, PaperPlaneRight, ShareNetwork, Trash } from 'phosphor-react';
import Button from '../../common/button/Button';
import IconButton from '../../common/icon_button/IconButton';
import CopyIconButton from '../solve_card/CopyIconButton';
import SendSolveModal from '../send_solve/SendSolveModal';
import block from '../../../styles/bem';
import { getApiBase } from '../../../util/api-base';
import { shareContent } from '../../../util/native-plugins';
import { generateSolvesStatsText } from '../../../util/average_text';
import { useMe } from '../../../util/hooks/useMe';
import { Solve } from '../../../../server/schemas/Solve.schema';

const b = block('solve-card');

interface Props {
	solve: Solve;
	/** Each layout's own rule for who may hand out the link. */
	canShareLink: boolean;
	disabled: boolean;
	editMode: boolean;
	/** The card has something to edit; without it there is no Edit button. */
	editable: boolean;
	/** Title of the native share sheet, "3x3 - 12.34 | Zkt Timer". */
	shareTitle: string;
	toggleEditMode: () => void;
	deleteSolve: () => void;
}

/**
 * The solve card's actions, the same on the normal and the smart card: copy the link, share
 * through the system sheet, send to someone; delete and edit. Bare icons with their names as
 * tooltips, so the row stays quiet and fits a phone on one line. Edit keeps its word because
 * it turns into Save.
 */
export default function SolveActions(props: Props) {
	const { solve, canShareLink, disabled, editMode, editable, shareTitle, toggleEditMode, deleteSolve } = props;
	const { t } = useTranslation();
	const me = useMe();
	const [sendOpen, setSendOpen] = useState(false);

	const solveUrl = getApiBase() + '/solve/' + solve.share_code;

	function handleShare() {
		// The link alone is the copy button's job, so the sheet shares the stats text
		// "View as stats" shows, with the link alongside: shareContent forwards url as its
		// own field to the native Share plugin, and the Web Share API takes both too.
		const statsText = generateSolvesStatsText(t, t('solve_info.single_solve'), solve.time, [solve], true);
		shareContent({ title: shareTitle, text: statsText, url: solveUrl });
	}

	// An old solve opened by someone other than its owner can lack a code (the server only
	// fills one in for the owner); a link to /solve/null would lead nowhere.
	const linkShown = typeof window !== 'undefined' && canShareLink && !!solve.share_code;
	// Only your own solve, because the server refuses to attach anyone else's.
	const sendShown = !!me && solve?.user_id === me.id;

	return (
		<div className={b('actions')}>
			{linkShown && (
				<>
					<CopyIconButton
						text={solveUrl}
						label={t('solve_info.share_link')}
						icon={<LinkSimple weight="bold" />}
						toastOnCopy={t('solve_info.link_copied')}
					/>
					<IconButton variant="ghost" label={t('solve_info.share')} icon={<ShareNetwork weight="bold" />} onClick={handleShare} />
				</>
			)}
			{sendShown && (
				<IconButton
					variant="ghost"
					label={t('solve_info.send_title')}
					icon={<PaperPlaneRight weight="bold" />}
					onClick={() => setSendOpen(true)}
				/>
			)}
			{!disabled && (
				<>
					<IconButton variant="ghost" label={t('solve_info.delete')} icon={<Trash weight="bold" />} onClick={deleteSolve} />
					{editable && (
						<Button
							small
							gray={!editMode}
							primary={editMode}
							text={editMode ? t('solve_info.save') : t('solve_info.edit')}
							onClick={toggleEditMode}
						/>
					)}
				</>
			)}
			{sendOpen && <SendSolveModal solveId={solve.id} onClose={() => setSendOpen(false)} />}
		</div>
	);
}
