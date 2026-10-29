import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'phosphor-react';
import IconButton from '../../common/icon_button/IconButton';
import { copyText } from '../../common/copy_text/CopyText';
import { toastSuccess } from '../../../util/toast';

interface Props {
	text: string;
	/** Tooltip and spoken name. */
	label: string;
	/** Defaults to the copy glyph; the check replaces it for two seconds after a copy. */
	icon?: React.ReactElement;
	/** Said once copied, for an icon that does not show what it copies. */
	toastOnCopy?: string;
}

/** CopyText's job as a bare icon, for the solve card's quiet rows. */
export default function CopyIconButton({ text, label, icon, toastOnCopy }: Props) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	function onClick() {
		copyText(text);
		setCopied(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), 2000);
		if (toastOnCopy) toastSuccess(toastOnCopy);
	}

	return (
		<IconButton
			variant="ghost"
			label={label}
			icon={copied ? <Check weight="bold" /> : icon || <Copy weight="bold" />}
			onClick={onClick}
		/>
	);
}
