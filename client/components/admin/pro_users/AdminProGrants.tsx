import React from 'react';
import {ProUsersList} from './AdminProUsers';

/** Members who got Pro through a promo code or from an admin. No filters, search only. */
export default function AdminProGrants() {
	return <ProUsersList kind="granted" />;
}
