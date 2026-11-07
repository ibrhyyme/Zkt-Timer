import { appendClimateLine, climateEventText, complaintCounts, formatTemp, ClimateLine } from '../climate/climate_text';
import { ClimateEventPayload } from '../../../../shared/friendly_room/climate';
import tr from '../../../i18n/locales/tr/translation.json';
import en from '../../../i18n/locales/en/translation.json';

// A tiny t(): looks the key up in a locale file and fills {{placeholders}}.
function makeT(locale: any) {
    return (key: string, opts: Record<string, unknown> = {}) => {
        const raw = key.split('.').reduce((o: any, k) => (o ? o[k] : undefined), locale);
        if (typeof raw !== 'string') throw new Error(`missing key ${key}`);
        return raw.replace(/\{\{(\w+)\}\}/g, (_, name) => String(opts[name] ?? ''));
    };
}

const tTr = makeT(tr);
const tEn = makeT(en);
const base = { room_id: 'r', at: 1000 };

describe('climateEventText', () => {
    it('inflects names in Turkish', () => {
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'holder', target: 'Mert' })).toBe("Kumanda Mert'e geçti");
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'basic_win', winner: 'Ece', holder: 'Kaan' })).toBe(
            "Turu Ece kazandı ama Pro değil, kumanda Kaan'da kaldı."
        );
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'holder_leave', target: 'İskender' })).toBe(
            "Kumanda son turun en hızlı Pro'su İskender'e geçti"
        );
    });

    it('says which way the setpoint moved', () => {
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'setpoint', actor: 'Kaan', value: 18, from: 22 })).toBe(
            "Kaan klimayı 18°C'ye düşürdü"
        );
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'setpoint', actor: 'Kaan', value: 25, from: 22 })).toBe(
            "Kaan klimayı 25°C'ye yükseltti"
        );
    });

    it('a Basic win with an empty remote names the Pro members', () => {
        expect(climateEventText(tTr, 'tr', { ...base, kind: 'basic_win', winner: 'Ece', holder: null })).toBe(
            'Turu Ece kazandı ama Pro değil, kumanda Pro üyelerde.'
        );
    });

    it('uses plain names in other languages', () => {
        expect(climateEventText(tEn, 'en', { ...base, kind: 'holder', target: 'Mert' })).toBe('Mert has the remote now');
        expect(climateEventText(tEn, 'en', { ...base, kind: 'ac_on', actor: 'Kaan', value: 22 })).toBe('Kaan turned the AC on, 22°C');
    });
});

describe('appendClimateLine', () => {
    const press = (value: number, from: number, at: number, actor_id = 'k'): ClimateEventPayload => ({
        room_id: 'r',
        kind: 'setpoint',
        actor_id,
        actor: 'Kaan',
        value,
        from,
        at,
    });

    it('merges a run of presses into one line from where it started', () => {
        let lines: ClimateLine[] = [];
        lines = appendClimateLine(lines, press(21, 22, 1000), 'a');
        lines = appendClimateLine(lines, press(20, 21, 1500), 'b');
        lines = appendClimateLine(lines, press(19, 20, 2000), 'c');
        expect(lines).toHaveLength(1);
        expect(lines[0].event.from).toBe(22);
        expect(lines[0].event.value).toBe(19);
    });

    it('drops the line when the run ends where it began', () => {
        let lines: ClimateLine[] = [];
        lines = appendClimateLine(lines, press(21, 22, 1000), 'a');
        lines = appendClimateLine(lines, press(22, 21, 1500), 'b');
        expect(lines).toHaveLength(0);
    });

    it('keeps separate lines for another holder or after a pause', () => {
        let lines: ClimateLine[] = [];
        lines = appendClimateLine(lines, press(21, 22, 1000), 'a');
        lines = appendClimateLine(lines, press(20, 21, 9000), 'b');
        lines = appendClimateLine(lines, press(19, 20, 9500, 'other'), 'c');
        expect(lines).toHaveLength(3);
    });
});

describe('complaintCounts', () => {
    it('counts each person once per side inside the window', () => {
        const now = 100_000;
        const r = (user_id: string, type: 'cold' | 'hot', at: number) => ({ room_id: 'r', user_id, type, at });
        expect(
            complaintCounts([r('a', 'cold', now - 1000), r('a', 'cold', now - 500), r('b', 'cold', now - 2000), r('c', 'hot', now - 40_000)], now)
        ).toEqual({ cold: 2, hot: 0 });
    });
});

describe('formatTemp', () => {
    it('uses the reader\'s decimal separator', () => {
        expect(formatTemp(24, 'tr')).toBe('24,0°C');
        expect(formatTemp(24, 'en')).toBe('24.0°C');
    });
});
