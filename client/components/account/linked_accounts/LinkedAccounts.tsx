import React from 'react';
import './LinkedAccounts.scss';
import block from '../../../styles/bem';
import IntegrationService from './integration_service/IntegrationService';
import WhatsappCommunityCard from './whatsapp_community/WhatsappCommunityCard';
import SettingsCard from '../common/settings_card/SettingsCard';

const b = block('account-linked-accounts');

export default function LinkedAccounts() {
	return (
		<div className={b()}>
			{/* ZKT first: it is the federation that runs the competitions these
			    accounts are for, and the identity Zkt Timer matches them on. */}
			<SettingsCard>
				<IntegrationService integrationType="zkt" />
			</SettingsCard>
			<SettingsCard>
				<IntegrationService integrationType="wca" />
			</SettingsCard>
			<SettingsCard>
				<WhatsappCommunityCard />
			</SettingsCard>
		</div>
	);
}
