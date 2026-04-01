import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './IntegrationService.scss';
import {Integration} from '../../../../@types/generated/graphql';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {Check, ArrowRight} from 'phosphor-react';
import {gql, useMutation, useQuery} from '@apollo/client';
import {INTEGRATION_FRAGMENT} from '../../../../util/graphql/fragments';
import Loading from '../../../common/loading/Loading';
import {IntegrationType, LINKED_SERVICES, LinkedServiceData} from '../../../../../shared/integration';
import {toastError} from '../../../../util/toast';
import {useMe} from '../../../../util/hooks/useMe';

const b = block('integration');

const INTEGRATION_QUERY = gql`
	${INTEGRATION_FRAGMENT}

	query Query($integrationType: IntegrationType!) {
		integration(integrationType: $integrationType) {
			...IntegrationFragment
		}
	}
`;

const REVOKE_INTEGRATION_MUTATION = gql`
	${INTEGRATION_FRAGMENT}

	mutation Mutate($integrationType: IntegrationType!) {
		deleteIntegration(integrationType: $integrationType) {
			...IntegrationFragment
		}
	}
`;

interface Props {
	integrationType: IntegrationType;
}

export default function IntegrationService(props: Props) {
	const {t} = useTranslation();
	const me = useMe();
	const {integrationType} = props;
	const [revokeMutate] = useMutation(REVOKE_INTEGRATION_MUTATION);
	const {data, loading} = useQuery<{integration: Integration}>(INTEGRATION_QUERY, {
		variables: {integrationType},
	});
	const [linking, setLinking] = useState(false);
	const [showDisconnect, setShowDisconnect] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);

	const service = LINKED_SERVICES[integrationType];
	const integration = data?.integration;

	const serviceUri = useMemo(() => {
		return getServiceUri(service);
	}, [integrationType]);

	function getServiceUri(ser: LinkedServiceData) {
		const base = ser.authEndpoint;
		const scope = ser.scope.join(' ');
		const redirectUri = `${window.origin}/oauth/${integrationType}`;

		const data = {
			client_id: ser.clientId,
			response_type: ser.responseType,
			scope,
			redirect_uri: redirectUri,
		};

		const queryParams = Object.keys(data)
			.map((key) => key + '=' + encodeURIComponent(data[key]))
			.join('&');

		return `${base}?${queryParams}`;
	}

	function handleLink() {
		if (linking || integration) return;
		setLinking(true);
		window.location.href = serviceUri;
	}

	async function handleConfirmDisconnect() {
		if (disconnecting) return;
		setDisconnecting(true);
		try {
			await revokeMutate({variables: {integrationType}});
			window.location.reload();
		} catch (e) {
			toastError(e);
			setDisconnecting(false);
		}
	}

	if (loading) {
		return <Loading />;
	}

	const hasPassword = me?.has_password;

	let revokeButton = null;
	if (integration) {
		if (!hasPassword) {
			revokeButton = (
				<p style={{fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem'}}>
					{t('integration.disconnect_no_password')}
				</p>
			);
		} else {
			revokeButton = (
				<Button
					text={t('integration.disconnect')}
					fullWidth
					danger
					onClick={() => setShowDisconnect(true)}
				/>
			);
		}
	}

	return (
		<div className={b()}>
			<div className={b('name')}>
				<img alt={`Logo for ${service.name}`} src={service.logoSrc} />
				<h4>{service.name}</h4>
			</div>
			<div className={b('description')}>
				<p>{t(`integration.${integrationType}_description`)}</p>
			</div>
			<div className={b('actions')}>
				<Button
					fullWidth
					large
					primary
					disabled={!!integration || linking}
					text={integration ? t('integration.account_linked') : linking ? t('integration.wca_connecting') : t('integration.link_account')}
					icon={integration ? <Check /> : <ArrowRight />}
					onClick={handleLink}
				/>
				{revokeButton}
			</div>

			{linking && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.7)',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 9999,
						gap: '16px',
					}}
				>
					<img src={service.logoSrc} alt={service.name} style={{width: '48px', height: '48px'}} />
					<span style={{color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem'}}>
						{t('integration.wca_connecting')}
					</span>
				</div>
			)}

			{showDisconnect && (
				<div
					onClick={() => !disconnecting && setShowDisconnect(false)}
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.6)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 9999,
						padding: '24px',
					}}
				>
					<div
						onClick={(e) => e.stopPropagation()}
						style={{
							backgroundColor: 'rgb(22, 25, 35)',
							borderRadius: '20px',
							padding: '28px 24px',
							width: '100%',
							maxWidth: '340px',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '16px',
							border: '1px solid rgba(255, 255, 255, 0.08)',
						}}
					>
						<img src={service.logoSrc} alt={service.name} style={{width: '48px', height: '48px'}} />
						<h3 style={{color: 'rgba(255, 255, 255, 0.95)', margin: 0, fontSize: '1.05rem', fontWeight: 600, textAlign: 'center'}}>
							{t('integration.disconnect_title', {name: service.name})}
						</h3>
						<p style={{color: 'rgba(255, 255, 255, 0.55)', margin: 0, textAlign: 'center', lineHeight: 1.5, fontSize: '0.85rem'}}>
							{t('integration.disconnect_confirm')}
						</p>
						<Button
							fullWidth
							large
							danger
							glow
							text={t('integration.disconnect_button')}
							loading={disconnecting}
							onClick={handleConfirmDisconnect}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
