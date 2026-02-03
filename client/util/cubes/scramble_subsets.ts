
export interface ScrambleSubset {
    id: string;      // Scrambow'a gönderilecek type ID (örn: '333pll')
    label: string;   // Ekranda görünecek isim (örn: 'PLL')
    isHeader?: boolean; // Başlık olup olmadığı
}

// Küp tipine göre subset haritası
export const SCRAMBLE_SUBSETS: Record<string, ScrambleSubset[]> = {
    '333': [
        { id: 'h_std', label: '=== STANDART (WCA) ===', isHeader: true },
        { id: '', label: 'WCA' },
        { id: 'oll', label: 'OLL' },
        { id: 'pll', label: 'PLL' },
        { id: 'll', label: 'LL (Last Layer)' },
        { id: 'edges', label: 'Sadece Kenarlar (Edges)' },

        { id: 'h_adv', label: '=== İLERİ ===', isHeader: true },
        { id: 'zbll', label: 'ZBLL' },
        { id: '2gll', label: '2GLL' },
        { id: 'zz', label: 'ZZ (Edge Orientation)' },
        { id: 'zzll', label: 'ZZLL' },
        { id: 'zzlsll', label: 'ZZLSLL' },
        { id: 'fmc', label: 'FMC' },

        { id: 'h_var', label: '=== VARYASYONLAR ===', isHeader: true },
        { id: 'lse', label: 'LSE (Six Edges)' },
        { id: 'cmll', label: 'CMLL' },
        { id: 'ble', label: 'BLE' },
        { id: 'cls', label: 'CLS' },
        { id: 'tsle', label: 'TSLE' },
        { id: 'wv', label: 'WV (Winter Variation)' },
        { id: 'lsll', label: 'LSLL' },
        { id: 'lccp', label: 'LCCP' },
        { id: 'nls', label: 'NLS' },
        { id: 'trizbll', label: 'Tri-ZBLL' },

        { id: 'h_gen', label: '=== GEN (Kısıtlı) ===', isHeader: true },
        { id: 'ru', label: 'RU (2-Gen)' },
        { id: 'lu', label: 'LU (2-Gen)' },
        { id: 'rud', label: 'RUD (3-Gen)' },
        { id: 'rul', label: 'RUL (3-Gen)' },
    ],
    // 2x2 subsets (EG, etc.) not natively supported by Scrambow v1.7.0
};

export const getSubsetsForCube = (cubeType: string): ScrambleSubset[] => {
    return SCRAMBLE_SUBSETS[cubeType] || [];
};
