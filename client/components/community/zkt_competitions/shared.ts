import block from '../../../styles/bem';

export const b = block('zkt-comp');

// How old a copy kept on the device (competition-cache) may be and still be drawn
// while the fresh one loads.
export const ZKT_SHOWN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
