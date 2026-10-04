import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {EnvelopeSimple, Trophy} from 'phosphor-react';
import Switch from '../../common/switch/Switch';
import {NOTIFICATION_PREFERENCE_FRAGMENT} from '../../../util/graphql/fragments';
import {gqlMutate} from '../../api';
import {gql, useQuery} from '@apollo/client';
import SettingsCard from '../common/settings_card/SettingsCard';
import SettingsRow from '../common/settings_row/SettingsRow';
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

	function setPreference(key: string, value: boolean) {
		setPrefs({...prefs, [key]: value});

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
				key,
				value,
			}
		);
	}

	const notificationTypeNames = [
		{
			key: 'marketing_emails',
			label: t('notification_prefs.marketing_emails'),
		},
		{
			key: 'support_ticket_reply',
			label: t('notification_prefs.support_ticket_reply'),
		},
	];

	// Push notifications, one switch per competition lifecycle type.
	const competitionTypeNames = [
		{
			key: 'zkt_competition_announced',
			label: t('notification_prefs.zkt_competition_announced'),
		},
		{
			key: 'competition_groups_published',
			label: t('notification_prefs.competition_groups_published'),
		},
		{
			key: 'competition_schedule_changed',
			label: t('notification_prefs.competition_schedule_changed'),
		},
		{
			key: 'competition_results_official',
			label: t('notification_prefs.competition_results_official'),
		},
	];

	function renderRows(types: {key: string; label: string}[]) {
		return types
			.filter((notifType) => notifType.key in prefs)
			.map((notifType) => (
				<SettingsRow
					key={notifType.key}
					label={notifType.label}
					control={
						<Switch
							on={!!prefs[notifType.key]}
							onChange={(on) => setPreference(notifType.key, on)}
						/>
					}
				/>
			));
	}

	return (
		<>
			<SettingsCard
				title={t('notification_prefs.email_notifications')}
				description={t('notification_prefs.email_notifications_description')}
				icon={<EnvelopeSimple weight="fill" />}
			>
				{renderRows(notificationTypeNames)}
			</SettingsCard>
			<SettingsCard
				title={t('notification_prefs.competition_notifications')}
				description={t('notification_prefs.competition_notifications_description')}
				icon={<Trophy weight="fill" />}
			>
				{renderRows(competitionTypeNames)}
			</SettingsCard>
		</>
	);
}
