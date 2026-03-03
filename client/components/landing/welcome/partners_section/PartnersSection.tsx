import React from 'react';
import {useTranslation} from 'react-i18next';
import './PartnersSection.scss';
import block from '../../../../styles/bem';
import { useInView } from '../hooks/useInView';

const b = block('welcome-partners');

interface Partner {
    name: string;
    logo: string;
    descriptionKey: string;
    category: 'official' | 'timer' | 'smart-cube';
    badge?: string;
}

const PARTNERS: Partner[] = [
    {
        name: 'WCA',
        logo: '/public/partners/wca.png',
        descriptionKey: 'welcome_partners.wca_desc',
        category: 'official',
    },
    {
        name: 'GAN Timer',
        logo: '/public/partners/gan-timer.png',
        descriptionKey: 'welcome_partners.gan_timer_desc',
        category: 'timer',
    },
    {
        name: 'StackMat',
        logo: '/public/partners/stackmat.png',
        descriptionKey: 'welcome_partners.stackmat_desc',
        category: 'timer',
    },
    {
        name: 'GAN Cube',
        logo: '/public/partners/gan.png',
        descriptionKey: 'welcome_partners.gan_cube_desc',
        category: 'smart-cube',
    },
    {
        name: 'MoYu',
        logo: '/public/partners/moyu.png',
        descriptionKey: 'welcome_partners.moyu_desc',
        category: 'smart-cube',
    },
];

export default function PartnersSection() {
    const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });
    const {t} = useTranslation();

    const CATEGORY_LABELS: Record<string, string> = {
        official: t('welcome_partners.category_official'),
        timer: t('welcome_partners.category_timer'),
        'smart-cube': t('welcome_partners.category_smart_cube'),
    };

    return (
        <section ref={ref as any} className={b({ visible: isInView })}>
            <div className={b('container')}>
                <div className={b('header')}>
                    <h2 className={b('title')}>{t('welcome_partners.title')}</h2>
                    <p className={b('description')}>
                        {t('welcome_partners.description')}
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
                                    alt={`${partner.name} - ${t(partner.descriptionKey)} - ZKT Timer`}
                                    loading="lazy"
                                />
                            </div>
                            <h3 className={b('card-name')}>{partner.name}</h3>
                            <p className={b('card-description')}>{t(partner.descriptionKey)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
