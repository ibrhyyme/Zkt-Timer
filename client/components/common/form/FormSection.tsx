import React, {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {useMe} from '../../../util/hooks/useMe';
import {useHistory} from 'react-router-dom';
import Tag from '../tag/Tag';
import {isNotPro} from '../../../util/pro';
import {closeModal} from '../../../actions/general';

interface Props {
	removeBorderBottom?: boolean;
	removePaddingTop?: boolean;
	removePaddingBottom?: boolean;
	proOnly?: boolean;
	children?: ReactNode;
}

export default function FormSection(props: Props) {
	const {proOnly, removePaddingBottom, removePaddingTop, removeBorderBottom} = props;

	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const history = useHistory();

	function goToPro() {
		dispatch(closeModal());
		history.push('/account/pro');
	}
	const classes = ['relative', 'border-solid', 'border-button'];
	if (!removePaddingTop) {
		classes.push('pt-7');
	}
	if (!removePaddingBottom) {
		classes.push('pb-7');
	}

	if (!removeBorderBottom) {
		classes.push('border-b-4');
	}

	let proTag = null;
	let body = props.children;

	if (proOnly && isNotPro(me)) {
		proTag = (
			<div
				onClick={goToPro}
				className="cursor-pointer inline-block"
			>
				<Tag text="PRO" textColor="orange" />
			</div>
		);
		body = (
			<div className="relative">
				<div className="opacity-40 pointer-events-none select-none">{props.children}</div>
				<div
					onClick={goToPro}
					className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer rounded-lg z-10 hover:bg-white/[0.03] transition-colors"
				>
					<span style={{color: '#a78bfa', fontSize: '1.2rem'}}>&#9733;</span>
					<span style={{color: '#fff', fontWeight: 600, fontSize: '0.85rem'}}>
						{t('pro.upgrade_button')}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className={classes.join(' ')}>
			{proTag}
			{body}
		</div>
	);
}
