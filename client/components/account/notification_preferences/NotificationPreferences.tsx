import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import Checkbox from '../../common/checkbox/Checkbox';
import {NOTIFICATION_PREFERENCE_FRAGMENT} from '../../../util/graphql/fragments';
import {gqlMutate} from '../../api';
import {gql, useQuery} from '@apollo/client';
import InputLegend from '../../common/inputs/input/input_legend/InputLegend';
import {NotificationPreference} from '../../../@types/generated/graphql';

const NOTIFICATION_PREFERENCES_QUERY = gql`
	${NOTIFICATION_PREFERENCE_FRAGMENT}
	query Query {
		notificationPreferences {
			...NotificationPreferenceFragment
		}
	}
`;

export default function NotificationPreferences() {
	const {t} = useTranslation();
	const [prefs, setPrefs] = useState({});
	const {data} = useQuery<{notificationPreferences: NotificationPreference}>(NOTIFICATION_PREFERENCES_QUERY);

	useEffect(() => {
		if (!data) {
			return;
		}
		setPrefs(data.notificationPreferences);
	}, [data]);

	function handleChange(e) {
		const newPrefs = {...prefs};
		newPrefs[e.target.name] = e.target.checked;
		setPrefs(newPrefs);

		gqlMutate(
			gql`
				${NOTIFICATION_PREFERENCE_FRAGMENT}
				mutation Mutate($key: String, $value: Boolean) {
					updateNotificationPreferences(key: $key, value: $value) {
						...NotificationPreferenceFragment
					}
				}
			`,
			{
				key: e.target.name,
				value: e.target.checked,
			}
		);
	}

	const notificationTypeNames = [
		{
			key: 'friend_request',
			label: t('notification_prefs.friend_request_accepted'),
		},
		{
			key: 'friend_request_accept',
			label: t('notification_prefs.friend_request_received'),
		},
		{
			key: 'elo_refund',
			label: t('notification_prefs.elo_refund'),
		},
		{
			key: 'marketing_emails',
			label: t('notification_prefs.marketing_emails'),
		},
	];

	const checkboxes = [];
	for (const notifTypeName of notificationTypeNames) {
		const pref = notifTypeName.key;
		const label = notifTypeName.label;

		if (pref in prefs) {
			checkboxes.push(
				<Checkbox key={pref} name={pref} text={label} onChange={handleChange} checked={prefs[pref]} />
			);
		}
	}

	return (
		<div>
			<InputLegend text={t('notification_prefs.email_notifications')} />
			{checkboxes}
		</div>
	);
}
