
import React from 'react';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';

export default function BluetoothErrorMessage() {

    let title = <span style={{ color: 'rgb(var(--error-color))' }}>Bluetooth kullanılamıyor!</span>;
    let description = <span style={{ color: 'rgb(var(--warning-color))' }}>Sisteminizde Bluetooth'un etkin olup olmadığını kontrol edin.</span>;

    return (
        <>
            <ModalHeader title={title} description={description} />
            <p>
                Tarayıcınız Web Bluetooth API'sini desteklemiyor olabilir.
                Uyumlu bir tarayıcı kullanmayı düşünün, en iyi seçenekler:
                <ul style={{ listStyle: 'disc', margin: '1em', paddingLeft: '1em' }}>
                    <li>macOS, Linux, Android veya Windows üzerinde Chrome</li>
                    <li>iOS üzerinde Bluefy</li>
                </ul>
                Ayrıca farklı tarayıcıların ve desteklenen Web Bluetooth API özelliklerinin tam listesi için &nbsp;
                <a style={{ textDecoration: 'underline' }} target='_blank'
                    href='https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md'>
                    Web Bluetooth Topluluk Grubu uygulama durumu
                </a>
                &nbsp; sayfasını kontrol edebilirsiniz.
            </p>
        </>
    );

}
