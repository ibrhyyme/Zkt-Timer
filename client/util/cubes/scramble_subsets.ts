
export interface ScrambleSubset {
    id: string;      // Scrambow'a gönderilecek type ID (örn: '333pll')
    label: string;   // i18n key veya direkt görüntülenecek isim
    isHeader?: boolean; // Başlık olup olmadığı
}

// Küp tipine göre subset haritası
export const SCRAMBLE_SUBSETS: Record<string, ScrambleSubset[]> = {
    '222': [
        { id: 'h_std', label: 'scramble_subsets.h_std', isHeader: true },
        { id: '', label: 'scramble_subsets.random_state' },
        { id: '222o', label: 'scramble_subsets.optimal' },
        { id: '2223', label: 'scramble_subsets.three_gen' },
        { id: '222nb', label: 'scramble_subsets.no_bar' },
        { id: 'h_eg', label: '=== EG ===', isHeader: true },
        { id: '222eg', label: 'scramble_subsets.eg_all' },
        { id: '222eg0', label: 'CLL' },
        { id: '222eg1', label: 'EG1' },
        { id: '222eg2', label: 'EG2' },
        { id: 'h_tcll', label: '=== TCLL ===', isHeader: true },
        { id: '222tcp', label: 'TCLL+' },
        { id: '222tcn', label: 'TCLL-' },
        { id: '222tc', label: 'TCLL' },
        { id: 'h_ls', label: '=== LS ===', isHeader: true },
        { id: '222lsall', label: 'LS (Last Slot)' },
    ],
    '333': [
        { id: 'h_std', label: 'scramble_subsets.h_std_wca', isHeader: true },
        { id: '', label: 'WCA' },
        { id: 'oll', label: 'OLL' },
        { id: 'pll', label: 'PLL' },
        { id: 'll', label: 'LL (Last Layer)' },
        { id: 'edges', label: 'scramble_subsets.edges_only' },

        { id: 'h_adv', label: 'scramble_subsets.h_adv', isHeader: true },
        { id: 'zbll', label: 'ZBLL' },
        { id: '2gll', label: '2GLL' },
        { id: 'zz', label: 'ZZ (Edge Orientation)' },
        { id: 'zzll', label: 'ZZLL' },
        { id: 'zzlsll', label: 'ZZLSLL' },
        { id: 'fmc', label: 'FMC' },

        { id: 'h_var', label: 'scramble_subsets.h_var', isHeader: true },
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

        { id: 'h_gen', label: 'scramble_subsets.h_gen', isHeader: true },
        { id: 'ru', label: 'RU (2-Gen)' },
        { id: 'lu', label: 'LU (2-Gen)' },
        { id: 'rud', label: 'RUD (3-Gen)' },
        { id: 'rul', label: 'RUL (3-Gen)' },
    ],
    // 2x2 subsets are handled by custom scramble_222.ts generator (ported from cstimer)
};

export const getSubsetsForCube = (cubeType: string): ScrambleSubset[] => {
    return SCRAMBLE_SUBSETS[cubeType] || [];
};
