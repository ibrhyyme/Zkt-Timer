import React from 'react';
import {Crown} from 'phosphor-react';
import block from '../../../styles/bem';
import './ProTag.scss';

const b = block('pro-tag');

// The "Pro" tag beside a gated option, for places without a stylesheet of their own.
// Styled sites include the same zt-pro-tag mixin (tokens.scss), so the look has one source.
export default function ProTag() {
	return (
		<span className={b()}>
			<Crown weight="fill" />
			Pro
		</span>
	);
}
