declare module 'cubing/twisty' {
    export class TwistyPlayer extends HTMLElement {
        constructor(options: any);
        puzzle: string;
        alg: string;
        visualization: string;
        background: string;
        controlPanel: string;
        hintFacelets: string;
        backView: string;
        experimentalSetupAlg: string;
        experimentalDragInput: string;
        experimentalStickering: string;
        experimentalStickeringMaskOrbits: any;
        tempoScale: number;
        experimentalAddMove(move: string, options?: {cancel?: boolean}): void;
    }
}
