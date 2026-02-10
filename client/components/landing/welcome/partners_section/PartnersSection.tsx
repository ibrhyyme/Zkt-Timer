import React from 'react';
import './PartnersSection.scss';
import block from '../../../../styles/bem';
import { useInView } from '../hooks/useInView';

const b = block('welcome-partners');

interface Partner {
    name: string;
    logo: string;
    description: string;
    category: 'official' | 'timer' | 'smart-cube';
    badge?: string;
}

const CATEGORY_LABELS = {
    official: '🏆 Resmi Standart',
    timer: '⏱️ Timer Desteği',
    'smart-cube': '🎯 Akıllı Küp',
};

const PARTNERS: Partner[] = [
    {
        name: 'WCA',
        logo: '/public/partners/wca.png',
        description: 'Resmi WCA scramble algoritmaları ve kuralları',
        category: 'official',
    },
    {
        name: 'GAN Timer',
        logo: '/public/partners/gan-timer.png',
        description: 'Bluetooth bağlantı ile kablosuz ölçüm',
        category: 'timer',
    },
    {
        name: 'StackMat',
        logo: '/public/partners/stackmat.png',
        description: 'WCA onaylı profesyonel timer desteği',
        category: 'timer',
    },
    {
        name: 'GAN Cube',
        logo: '/public/partners/gan.png',
        description: 'Gerçek zamanlı çözüm takibi ve analiz',
        category: 'smart-cube',
    },
    {
        name: 'MoYu',
        logo: '/public/partners/moyu.png',
        description: 'AI destekli akıllı küp entegrasyonu',
        category: 'smart-cube',
    },
];

export default function PartnersSection() {
    const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });

    return (
        <section ref={ref as any} className={b({ visible: isInView })}>
            <div className={b('container')}>
                <div className={b('header')}>
                    <h2 className={b('title')}>Profesyonel Entegrasyonlar</h2>
                    <p className={b('description')}>
                        WCA standartları, akıllı küpler ve profesyonel timer'lar ile tam uyumlu.
                        En gelişmiş speedcubing ekipmanlarıyla sorunsuz çalışır.
                    </p>
                </div>

                <div className={b('grid')}>
                    {PARTNERS.map((partner, index) => (
                        <div
                            key={partner.name}
                            className={b('card', { category: partner.category })}
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className={b('card-badge')}>
                                {CATEGORY_LABELS[partner.category]}
                            </div>
                            <div className={b('card-logo')}>
                                <img
                                    src={partner.logo}
                                    alt={`${partner.name} - ${partner.description} - ZKT Timer entegrasyonu`}
                                    loading="lazy"
                                />
                            </div>
                            <h3 className={b('card-name')}>{partner.name}</h3>
                            <p className={b('card-description')}>{partner.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
