
import React from 'react';
import { useTranslation } from 'react-i18next';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';

export default function BluetoothErrorMessage() {
    const { t } = useTranslation();

    const title = <span style={{ color: 'rgb(var(--error-color))' }}>{t('smart_cube.bt_unavailable_title')}</span>;
    const description = <span style={{ color: 'rgb(var(--warning-color))' }}>{t('smart_cube.bt_check_enabled')}</span>;

    return (
        <>
            <ModalHeader title={title} description={description} />
            <p>
                {t('smart_cube.bt_browser_hint')}
                <ul style={{ listStyle: 'disc', margin: '1em', paddingLeft: '1em' }}>
                    <li>{t('smart_cube.bt_browser_chrome')}</li>
                    <li>{t('smart_cube.bt_browser_bluefy')}</li>
                </ul>
                {t('smart_cube.bt_status_link_pre')}&nbsp;
                <a style={{ textDecoration: 'underline' }} target='_blank'
                    href='https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md'>
                    {t('smart_cube.bt_status_link_text')}
                </a>
                &nbsp;{t('smart_cube.bt_status_link_post')}
            </p>
        </>
    );

}
