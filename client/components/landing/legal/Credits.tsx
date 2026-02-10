import React from 'react';
import './Legal.scss';
import block from '../../../styles/bem';

const b = block('landing-legal');

export default function Credits() {
    return (
        <div className={b()}>
            <h1>NOTICE AND ACKNOWLEDGMENTS</h1>
            <p>
                This project, <strong>zkt-timer</strong>, is a specialized derivative work developed by{' '}
                <strong>ibrhyyme</strong>. It stands on the shoulders of giants, built upon the foundation of several
                incredible open-source projects. We utilize various libraries to provide a comprehensive and premium
                cubing experience.
            </p>

            <p>
                We deeply acknowledge, respect, and thank the original authors and the open-source community for their
                tireless efforts. This page lists the projects that served as a base, inspiration, or were directly
                integrated into <strong>zkt-timer</strong>.
            </p>

            <h2>Core Foundation & Architecture</h2>
            <p>
                The core architecture of this project is based on the <strong>cubedesk</strong> project. We are immensely
                grateful to the original author for laying the groundwork that made <strong>zkt-timer</strong> possible.
            </p>
            <ul>
                <li>
                    <strong>Original Project Architecture:</strong> Derived from <strong>cubedesk</strong> by{' '}
                    <strong>kash</strong>.
                </li>
            </ul>

            <h2>Features & Inspirations</h2>
            <p>
                Several key features of <strong>zkt-timer</strong> were inspired by, adapted from, or implemented after
                studying the following open-source projects. We extends our gratitude to these developers for their
                contributions to the speedcubing community:
            </p>
            <ul>
                <li>
                    <strong>Multiplayer System (Friendly Competition):</strong> The logic for the "LetsCube" friendly
                    competition mode was inspired by the work of <strong>coder13</strong>.
                </li>
                <li>
                    <strong>Scramble Generation & Analysis:</strong> The 2x2 subset scramble generation and the
                    multi-phase analysis features were implemented by studying the open-source code of{' '}
                    <strong>cstimer</strong> and <strong>min2phase</strong>, developed by <strong>cs0x7f</strong>.
                </li>
                <li>
                    <strong>Algorithm Tutorials:</strong> The algorithm learning modules and smart cube support for
                    tutorials are based on concepts and code from <strong>cubedex</strong> by <strong>poliva</strong>.
                </li>
                <li>
                    <strong>Smart Cube & Bluetooth Integration:</strong> The Bluetooth connection handling and
                    gyroscope/movement logic for smart cubes were supported by the examples and libraries provided in{' '}
                    <strong>gan-web-bluetooth</strong> by <strong>afedotov</strong>.
                </li>
            </ul>

            <h2>Third-Party Libraries</h2>
            <p>
                This software includes components and libraries from various open-source projects. A full list of
                dependencies can be found in the <code>package.json</code> file. We are grateful to the maintainers of
                these libraries for their work.
            </p>

            <h2>Copyright Notices</h2>
            <p>
                Portions of this software may utilize code or concepts from the aforementioned projects, which retain
                their original copyrights.
            </p>
            <ul>
                <li>
                    Copyright (c) 2021-2023 <strong>kash</strong> (cubedesk)
                </li>
                <li>
                    Copyright (c) 2023 <strong>coder13</strong>
                </li>
                <li>
                    Copyright (c) 2023 <strong>cs0x7f</strong>
                </li>
                <li>
                    Copyright (c) 2023 <strong>poliva</strong>
                </li>
                <li>
                    Copyright (c) 2023 <strong>afedotov</strong>
                </li>
            </ul>
            <p>
                <strong>zkt-timer Modifications and New Features:</strong>
                <br />
                Copyright (c) 2026 <strong>ibrhyyme</strong>
            </p>

            <hr />

            <h1>BİLDİRİM VE TEŞEKKÜRLER</h1>
            <p>
                Bu proje, <strong>zkt-timer</strong>, <strong>ibrhyyme</strong> tarafından geliştirilmiş özel bir türev
                çalışmadır. Bu proje, devlerin omuzlarında yükselmekte olup, birçok inanılmaz açık kaynak projenin
                temelleri üzerine inşa edilmiştir. Kapsamlı ve üst düzey bir küp çözme deneyimi sunmak için çeşitli
                kütüphanelerden yararlanıyoruz.
            </p>

            <p>
                Orijinal yazarlara ve açık kaynak topluluğuna, yorulmak bilmez çabaları için derin saygı duyuyor ve
                teşekkür ediyoruz. Bu sayfa, <strong>zkt-timer</strong>'a temel oluşturan, ilham veren veya doğrudan
                entegre edilen projeleri listelemektedir.
            </p>

            <h2>Temel Yapı ve Mimari</h2>
            <p>
                Bu projenin çekirdek mimarisi <strong>cubedesk</strong> projesine dayanmaktadır. <strong>zkt-timer</strong>'ın
                hayata geçmesini sağlayan bu temeli attığı için orijinal yazara minnettarız.
            </p>
            <ul>
                <li>
                    <strong>Orijinal Proje Mimarisi:</strong> <strong>kash</strong> tarafından geliştirilen{' '}
                    <strong>cubedesk</strong> projesinden türetilmiştir.
                </li>
            </ul>

            <h2>Özellikler ve İlham Kaynakları</h2>
            <p>
                <strong>zkt-timer</strong>'ın bazı temel özellikleri, aşağıdaki açık kaynak projeler incelenerek ilham
                alınmış, uyarlanmış veya uygulanmıştır. Hız küpü (speedcubing) topluluğuna katkılarından dolayı bu
                geliştiricilere teşekkürlerimizi sunarız:
            </p>
            <ul>
                <li>
                    <strong>Çok Oyunculu Sistem (Dostluk Yarışması):</strong> "LetsCube" dostluk yarışması modunun
                    mantığı, <strong>coder13</strong>'ün çalışmalarından ilham almıştır.
                </li>
                <li>
                    <strong>Karıştırma (Scramble) ve Analiz:</strong> 2x2 alt küme karıştırma ve çok aşamalı analiz
                    özellikleri, <strong>cs0x7f</strong> tarafından geliştirilen <strong>cstimer</strong> ve{' '}
                    <strong>min2phase</strong> açık kaynak kodları incelenerek uygulanmıştır.
                </li>
                <li>
                    <strong>Algoritma Eğitimleri:</strong> Algoritma öğrenme modülleri ve akıllı küp desteği,{' '}
                    <strong>poliva</strong> tarafından geliştirilen <strong>cubedex</strong> konseptlerine ve kodlarına
                    dayanmaktadır.
                </li>
                <li>
                    <strong>Akıllı Küp ve Bluetooth Entegrasyonu:</strong> Akıllı küpler için Bluetooth bağlantı
                    yönetimi ve jiroskop/hareket mantığı, <strong>afedotov</strong> tarafından sağlanan{' '}
                    <strong>gan-web-bluetooth</strong> örnekleri ve kütüphaneleri ile desteklenmiştir.
                </li>
            </ul>

            <h2>Üçüncü Taraf Kütüphaneler</h2>
            <p>
                Bu yazılım, çeşitli açık kaynak projelerden bileşenler ve kütüphaneler içermektedir. Bağımlılıkların tam
                listesi <code>package.json</code> dosyasında bulunabilir. Bu kütüphanelerin bakımını yapanlara
                çalışmaları için minnettarız.
            </p>
        </div>
    );
}
