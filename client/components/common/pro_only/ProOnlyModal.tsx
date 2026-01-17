import React from 'react';
import block from '../../../styles/bem';
import ModalHeader from '../modal/modal_header/ModalHeader';

const b = block('pro-only-modal');

export default function ProOnlyModal() {
	return (
		<div className={b()}>
			<ModalHeader
				title="Pro Feature"
				description="This feature is available to all users."
			/>
		</div>
	);
}
