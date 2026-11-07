import {
    ClimateConst,
    ClimateEventPayload,
    ClimateLevel,
    ClimateReactionPayload,
    trDative,
    trLocative,
} from '../../../../shared/friendly_room/climate';

type T = (key: string, options?: Record<string, unknown>) => string;

/** "24,0°C" in Turkish, "24.0°C" in English: one decimal, the reader's separator. */
export function formatTemp(temp: number, lang: string): string {
    const n = new Intl.NumberFormat(lang || 'en', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${n.format(temp)}°C`;
}

/**
 * Name forms for a translation. Turkish strings take the inflected placeholders
 * ({{target_dat}}, {{holder_loc}}); the other languages use the name as it is.
 */
export function nameForms(prefix: string, name: string | null | undefined, lang: string): Record<string, string> {
    const plain = name ?? '';
    const tr = lang.startsWith('tr');
    return {
        [prefix]: plain,
        [`${prefix}_dat`]: tr && plain ? trDative(plain) : plain,
        [`${prefix}_loc`]: tr && plain ? trLocative(plain) : plain,
    };
}

/** The system line for a climate event, or null for an event that has no line. */
export function climateEventText(t: T, lang: string, e: ClimateEventPayload): string | null {
    const actor = nameForms('actor', e.actor, lang);
    switch (e.kind) {
        case 'ac_on':
            return t('rooms.climate.ev_ac_on', { ...actor, value: e.value });
        case 'ac_off':
            return t('rooms.climate.ev_ac_off', actor);
        case 'setpoint':
            if (e.from === undefined || e.value === undefined || e.value === e.from) return null;
            return t(e.value < e.from ? 'rooms.climate.ev_set_down' : 'rooms.climate.ev_set_up', { ...actor, value: e.value });
        case 'holder':
            return t('rooms.climate.ev_holder', nameForms('target', e.target, lang));
        case 'holder_leave':
            return t('rooms.climate.ev_holder_leave', nameForms('target', e.target, lang));
        case 'basic_win':
            return e.holder
                ? t('rooms.climate.ev_basic_win', { ...nameForms('winner', e.winner, lang), ...nameForms('holder', e.holder, lang) })
                : t('rooms.climate.ev_basic_win_empty', nameForms('winner', e.winner, lang));
        case 'no_pro_off':
            return t('rooms.climate.ev_no_pro_off');
        default:
            return null;
    }
}

export interface ClimateLine {
    id: string;
    at: number;
    event: ClimateEventPayload;
}

// Within this long, a holder's run of key presses reads as one change in the chat.
const SETPOINT_MERGE_MS = 4000;

/**
 * Append an event to the chat's climate lines. Five presses on "down" become one
 * "lowered to 17°C" line (measured from where the run started), and a run that ends where
 * it began leaves no line at all.
 */
export function appendClimateLine(lines: ClimateLine[], e: ClimateEventPayload, id: string, max = 60): ClimateLine[] {
    const last = lines[lines.length - 1];
    if (
        e.kind === 'setpoint' &&
        last &&
        last.event.kind === 'setpoint' &&
        last.event.actor_id === e.actor_id &&
        e.at - last.at < SETPOINT_MERGE_MS
    ) {
        const merged: ClimateEventPayload = { ...e, from: last.event.from };
        const rest = lines.slice(0, -1);
        if (merged.value === merged.from) return rest;
        return [...rest, { id: last.id, at: e.at, event: merged }];
    }
    const next = [...lines, { id, at: e.at, event: e }];
    return next.length > max ? next.slice(next.length - max) : next;
}

/** People complaining in the last 30 seconds, each counted once per side. */
export function complaintCounts(reactions: ClimateReactionPayload[], now: number): { cold: number; hot: number } {
    const cold = new Set<string>();
    const hot = new Set<string>();
    for (const r of reactions) {
        if (now - r.at >= ClimateConst.COMPLAINT_WINDOW_MS) continue;
        (r.type === 'cold' ? cold : hot).add(r.user_id);
    }
    return { cold: cold.size, hot: hot.size };
}

export const CLIMATE_LEVEL_KEYS: Record<ClimateLevel, string> = {
    freezing: 'rooms.climate.level.freezing',
    cool: 'rooms.climate.level.cool',
    normal: 'rooms.climate.level.normal',
    hot: 'rooms.climate.level.hot',
    fire: 'rooms.climate.level.fire',
};
