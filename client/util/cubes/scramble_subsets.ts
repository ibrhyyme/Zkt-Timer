
export interface ScrambleSubset {
    id: string;
    label: string;
    isHeader?: boolean;
}

// cstimer scrdata'sinin birebir karsiligi.
// Her cube type icin alt tipler (2. dropdown icerik).
export const SCRAMBLE_SUBSETS: Record<string, ScrambleSubset[]> = {
    // ==================== WCA (tum WCA etkinlikleri) ====================
    'wca': [
        { id: '333', label: '3x3x3' },
        { id: '222', label: '2x2x2' },
        { id: '444', label: '4x4x4' },
        { id: '555', label: '5x5x5' },
        { id: '666', label: '6x6x6' },
        { id: '777', label: '7x7x7' },
        { id: 'clock', label: 'Clock' },
        { id: 'minx', label: 'Megaminx' },
        { id: 'pyram', label: 'Pyraminx' },
        { id: 'skewb', label: 'Skewb' },
        { id: 'sq1', label: 'Square-1' },
    ],

    // ==================== 3x3x3 ====================
    '333': [
        { id: '', label: 'scramble_subsets.random_state' },
        { id: '333o', label: 'scramble_subsets.random_move' },
        { id: 'edges', label: 'scramble_subsets.edges_only' },
        { id: 'corners', label: 'scramble_subsets.corners_only' },
        { id: '333ni', label: 'scramble_subsets.blind' },
        { id: '333fm', label: 'FMC' },
        { id: '333oh', label: 'scramble_subsets.one_handed' },
        { id: '333mbld', label: 'scramble_subsets.multi_bld' },
        { id: '333mirror', label: 'scramble_subsets.mirror' },
    ],

    // ==================== 3x3x3 CFOP ====================
    '333cfop': [
        { id: 'pll', label: 'PLL' },
        { id: 'oll', label: 'OLL' },
        { id: 'lsll2', label: 'scramble_subsets.last_slot_last_layer' },
        { id: 'll', label: 'scramble_subsets.last_layer' },
        { id: 'zbll', label: 'ZBLL' },
        { id: 'coll', label: 'COLL' },
        { id: 'cll', label: 'CLL' },
        { id: 'ell', label: 'ELL' },
        { id: '2gll', label: '2GLL' },
        { id: 'zzll', label: 'ZZLL' },
        { id: 'zbls', label: 'ZBLS' },
        { id: 'eols', label: 'EOLS' },
        { id: 'wvls', label: 'WVLS' },
        { id: 'vls', label: 'VLS' },
        { id: 'ttll', label: 'TTLL' },
        { id: 'f2l', label: 'scramble_subsets.cross_solved' },
        { id: 'eoline', label: 'EOLine' },
        { id: 'eocross', label: 'EO Cross' },
    ],

    // ==================== 3x3x3 Roux ====================
    '333roux': [
        { id: 'sbrx', label: 'scramble_subsets.second_block' },
        { id: 'cmll', label: 'CMLL' },
        { id: 'lse', label: 'LSE' },
        { id: 'lsemu', label: 'LSE <M, U>' },
    ],

    // ==================== 3x3x3 Mehta ====================
    '333mehta': [
        { id: 'mt3qb', label: '3QB' },
        { id: 'mteole', label: 'EOLE' },
        { id: 'mttdr', label: 'TDR' },
        { id: 'mt6cp', label: '6CP' },
        { id: 'mtcdrll', label: 'CDRLL' },
        { id: 'mtl5ep', label: 'L5EP' },
        { id: 'ttll', label: 'TTLL' },
    ],

    // ==================== 3x3x3 ZZ ====================
    '333zz': [
        { id: 'eoline', label: 'EO Line' },
        { id: 'eocross', label: 'EO Cross' },
        { id: 'zzll', label: 'ZZLL' },
        { id: 'zbll', label: 'ZBLL' },
        { id: 'zbls', label: 'ZBLS' },
    ],

    // ==================== 2x2x2 ====================
    '222': [
        { id: '', label: 'scramble_subsets.random_state' },
        { id: '222o', label: 'scramble_subsets.optimal' },
        { id: '2223', label: '3-Gen' },
        { id: '222eg', label: 'EG' },
        { id: '222eg0', label: 'CLL' },
        { id: '222eg1', label: 'EG1' },
        { id: '222eg2', label: 'EG2' },
        { id: '222tcp', label: 'TCLL+' },
        { id: '222tcn', label: 'TCLL-' },
        { id: '222tc', label: 'TCLL' },
        { id: '222lsall', label: 'LS' },
        { id: '222nb', label: 'scramble_subsets.no_bar' },
        { id: '222oh', label: 'scramble_subsets.one_handed' },
    ],

    // ==================== 4x4x4 ====================
    '444': [
        { id: '', label: 'WCA' },
        { id: 'RrUu', label: 'R, r, U, u' },
        { id: '4edge', label: 'scramble_subsets.edges_444' },
        { id: '444ll', label: 'scramble_subsets.last_layer' },
        { id: '444ell', label: 'ELL' },
        { id: '444edo', label: 'scramble_subsets.edge_only' },
        { id: '444cto', label: 'scramble_subsets.center_only' },
        { id: '444bld', label: 'scramble_subsets.blind' },
    ],

    // ==================== 4x4x4 Yau/Hoya ====================
    '444yau': [
        { id: '', label: 'WCA' },
        { id: '444ctud', label: 'scramble_subsets.ud_center_solved' },
        { id: '444ud3c', label: 'scramble_subsets.ud_plus_3e_solved' },
        { id: '444l8e', label: 'scramble_subsets.last_8_dedges' },
        { id: '444ctrl', label: 'scramble_subsets.rl_center_solved' },
        { id: '444rlda', label: 'scramble_subsets.rldx_center_solved' },
        { id: '444rlca', label: 'scramble_subsets.rldx_cross_solved' },
    ],

    // ==================== 5x5x5 ====================
    '555': [
        { id: '', label: 'WCA' },
        { id: '555', label: 'SiGN' },
        { id: '5edge', label: 'scramble_subsets.edges_555' },
        { id: '555bld', label: 'scramble_subsets.blind' },
    ],

    // ==================== 6x6x6 ====================
    '666': [
        { id: '', label: 'WCA' },
        { id: '666si', label: 'SiGN' },
        { id: '666p', label: 'Prefix' },
        { id: '6edge', label: 'scramble_subsets.edges_666' },
    ],

    // ==================== 7x7x7 ====================
    '777': [
        { id: '', label: 'WCA' },
        { id: '777si', label: 'SiGN' },
        { id: '777p', label: 'Prefix' },
        { id: '7edge', label: 'scramble_subsets.edges_777' },
    ],

    // ==================== Clock ====================
    clock: [
        { id: '', label: 'scramble_subsets.optimal' },
        { id: 'clkwca', label: 'WCA' },
        { id: 'clkwcab', label: 'scramble_subsets.wca_old' },
        { id: 'clknf', label: 'scramble_subsets.wca_no_y2' },
        { id: 'clkc', label: 'scramble_subsets.concise' },
        { id: 'clke', label: 'scramble_subsets.efficient_pin_order' },
        { id: 'clk', label: 'Jaap' },
    ],

    // ==================== Megaminx ====================
    minx: [
        { id: '', label: 'WCA' },
        { id: 'mgmc', label: 'Carrot' },
        { id: 'mgmo', label: 'scramble_subsets.old_style' },
        { id: 'minx2g', label: '2-Generator R, U' },
        { id: 'mgmso', label: 'scramble_subsets.random_state' },
        { id: 'mgms2l', label: 'S2L' },
        // cstimer'da ayrica: mlsll (LSLL), mgmpll (PLL), mgmll (LL) — generator port edilmedi
    ],

    // ==================== Pyraminx ====================
    pyram: [
        { id: '', label: 'scramble_subsets.random_state' },
        { id: 'pyro', label: 'scramble_subsets.optimal' },
        { id: 'pyrm', label: 'scramble_subsets.random_move' },
        { id: 'pyr4c', label: 'scramble_subsets.four_tips' },
        { id: 'pyrnb', label: 'scramble_subsets.no_bar' },
    ],

    // ==================== Skewb ====================
    skewb: [
        { id: '', label: 'scramble_subsets.random_state' },
        { id: 'skbo', label: 'scramble_subsets.optimal' },
        { id: 'skb', label: 'scramble_subsets.random_move' },
        { id: 'skbnb', label: 'scramble_subsets.no_bar' },
    ],

    // ==================== Square-1 ====================
    sq1: [
        { id: '', label: 'scramble_subsets.random_state' },
        { id: 'sqrcsp', label: 'CSP' },
        { id: 'sq1pll', label: 'PLL' },
        { id: 'sq1h', label: 'scramble_subsets.face_turn_metric' },
        { id: 'sq1t', label: 'scramble_subsets.twist_metric' },
    ],

    // ==================== 3x3 Subsets ====================
    '333sub': [
        { id: '2gen', label: '2-Generator R, U' },
        { id: '2genl', label: '2-Generator L, U' },
        { id: 'roux', label: 'Roux-Generator M, U' },
        { id: '3gen_F', label: '3-Generator F, R, U' },
        { id: '3gen_L', label: '3-Generator R, U, L' },
        { id: 'RrU', label: '3-Generator R, r, U' },
        { id: '333drud', label: 'Domino Subgroup' },
        { id: 'half', label: 'scramble_subsets.half_turns' },
    ],

};

export const getSubsetsForCube = (cubeType: string): ScrambleSubset[] => {
    return SCRAMBLE_SUBSETS[cubeType] || [];
};
