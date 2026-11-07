// The AC's "bip" (WebAudio square wave, the prototype's sound). Browsers and the native
// WebViews only allow audio after a user gesture, so the context is created on the
// viewer's own key press; someone else's change only beeps once that has happened.

let ctx: AudioContext | null = null;

export function climateBeep(kind: 'key' | 'power', fromUser: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        if (!ctx) {
            if (!fromUser) return;
            const Ctor = window.AudioContext || (window as any).webkitAudioContext;
            if (!Ctor) return;
            ctx = new Ctor();
        }
        if (ctx.state === 'suspended') void ctx.resume();
        const offsets = kind === 'power' ? [0, 0.12] : [0];
        for (const off of offsets) {
            const t0 = ctx.currentTime + off;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 2900;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.09);
        }
    } catch {
        // No audio on this device: the AC stays silent.
    }
}
