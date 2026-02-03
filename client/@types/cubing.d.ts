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
    }
}
