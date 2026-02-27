import type { CubeFace } from '../../components/trainer/types';

/**
 * cubing.js SVG'de kullandığı yüz renkleri.
 * Bu değerler style.fill ile inline olarak set ediliyor.
 */
const FACE_COLORS: Record<CubeFace, string> = {
    U: 'white',
    D: 'yellow',
    R: 'red',
    L: 'orange',
    F: 'limegreen',
    B: 'rgb(34, 102, 255)',
};

const OPPOSITE_FACE: Record<CubeFace, CubeFace> = {
    U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R',
};

/**
 * Verilen topFace ve frontFace bilgisine göre, standart oryantasyondaki (U=white)
 * renklerin hangi renklere dönüştürülmesi gerektiğini hesaplar.
 *
 * Mantık: Kullanıcı "top=R, front=F" seçtiğinde, küp döndürülmeden OLL stickering
 * uygulanıyor (U katmanı maskeleniyor). Ancak görsel olarak kullanıcının seçtiği
 * üst yüzün renginin (kırmızı) U rengi olarak görünmesi lazım. Bu fonksiyon
 * "hangi standart renk → hangi görsel renge dönüşecek" mapping'ini döner.
 */
export function getOLLColorSwapMap(
    topFace: CubeFace,
    frontFace: CubeFace
): Map<string, string> | null {
    // Standart oryantasyon — renk değişikliği gerekmez
    if (topFace === 'U' && frontFace === 'F') return null;

    // Hangi fiziksel yüz nereye gidiyor, onu hesapla
    const mapping = computeFaceMapping(topFace, frontFace);
    if (!mapping) return null;

    const colorMap = new Map<string, string>();
    for (const standardFace of Object.keys(FACE_COLORS) as CubeFace[]) {
        const targetFace = mapping[standardFace];
        const standardColor = FACE_COLORS[standardFace];
        const targetColor = FACE_COLORS[targetFace];
        if (standardColor !== targetColor) {
            colorMap.set(standardColor, targetColor);
        }
    }

    return colorMap.size > 0 ? colorMap : null;
}

/**
 * Standart oryantasyondaki her yüzün, kullanıcının seçtiği oryantasyonda
 * hangi yüze karşılık geldiğini hesaplar.
 *
 * Örnek: topFace=R, frontFace=F ise:
 * - Standart U → kullanıcının oryantasyonunda R (çünkü kullanıcı R'ı üste koydu)
 * - Yani U rengi (beyaz) → R rengi (kırmızı) olmalı
 */
function computeFaceMapping(
    topFace: CubeFace,
    frontFace: CubeFace
): Record<CubeFace, CubeFace> | null {
    const bottomFace = OPPOSITE_FACE[topFace];
    const backFace = OPPOSITE_FACE[frontFace];

    // Sağ ve sol yüzleri hesapla (cross product mantığı ile)
    const rightFace = getRightFace(topFace, frontFace);
    if (!rightFace) return null;
    const leftFace = OPPOSITE_FACE[rightFace];

    // Standart → hedef mapping:
    // "Standart U pozisyonundaki yüz" → "kullanıcının oryantasyonunda U pozisyonundaki yüz"
    return {
        U: topFace,
        D: bottomFace,
        F: frontFace,
        B: backFace,
        R: rightFace,
        L: leftFace,
    };
}

/**
 * Top ve front yüzlerine göre sağ yüzü hesaplar.
 * Rubik küpü konvansiyonu: Right = cross(Up, Front)
 */
function getRightFace(topFace: CubeFace, frontFace: CubeFace): CubeFace | null {
    // Yüz vektör karşılıkları
    const vectors: Record<CubeFace, [number, number, number]> = {
        U: [0, 1, 0],
        D: [0, -1, 0],
        R: [1, 0, 0],
        L: [-1, 0, 0],
        F: [0, 0, 1],
        B: [0, 0, -1],
    };

    const up = vectors[topFace];
    const front = vectors[frontFace];

    // Cross product: up × front
    const cross: [number, number, number] = [
        up[1] * front[2] - up[2] * front[1],
        up[2] * front[0] - up[0] * front[2],
        up[0] * front[1] - up[1] * front[0],
    ];

    // Sonucu yüze çevir
    for (const [face, vec] of Object.entries(vectors) as [CubeFace, [number, number, number]][]) {
        if (cross[0] === vec[0] && cross[1] === vec[1] && cross[2] === vec[2]) {
            return face;
        }
    }

    return null;
}

/**
 * cubing.js kapalı (closed) shadow DOM kullanıyor. `.shadowRoot` null döner,
 * ama `.shadow` public property'si üzerinden erişilebilir.
 */
function getShadow(el: Element): ShadowRoot | null {
    return (el as any).shadow || el.shadowRoot || null;
}

/**
 * İç içe kapalı shadow DOM'ları traverse ederek twisty-2d-puzzle elementini bulur.
 *
 * DOM hiyerarşisi:
 *   <twisty-player>.shadow
 *     └─ <twisty-2d-scene-wrapper>.shadow
 *          └─ <twisty-2d-puzzle>
 */
function findPuzzle2D(container: HTMLElement): Element | null {
    const twistyPlayer = container.querySelector('twisty-player');
    if (!twistyPlayer) return null;

    const playerShadow = getShadow(twistyPlayer);
    if (!playerShadow) return null;

    const sceneWrapper = playerShadow.querySelector('twisty-2d-scene-wrapper');
    if (!sceneWrapper) return null;

    const sceneShadow = getShadow(sceneWrapper);
    if (!sceneShadow) return null;

    return sceneShadow.querySelector('twisty-2d-puzzle');
}

/**
 * Bir renk sözlüğündeki değerleri colorSwapMap'e göre swap eder.
 */
function swapColorsInDict(
    dict: Record<string, string>,
    colorSwapMap: Map<string, string>
): void {
    for (const [id, color] of Object.entries(dict)) {
        if (colorSwapMap.has(color)) {
            dict[id] = colorSwapMap.get(color)!;
        }
    }
}

/**
 * Puzzle elementinin shadow DOM'undaki SVG <stop> elementlerinin
 * stop-color değerlerini swap eder (anlık görsel güncelleme).
 */
function updateStopElements(
    puzzle2D: Element,
    colorSwapMap: Map<string, string>
): void {
    const puzzleShadow = getShadow(puzzle2D);
    if (!puzzleShadow) return;

    const stops = puzzleShadow.querySelectorAll('stop');
    for (const stop of Array.from(stops)) {
        const cur = stop.getAttribute('stop-color');
        if (cur && colorSwapMap.has(cur)) {
            stop.setAttribute('stop-color', colorSwapMap.get(cur)!);
        }
    }
}

/**
 * twisty-2d-puzzle elementinin svgWrapper.originalColors sözlüğünü yamalar
 * ve resetSVG metodunu monkey-patch ederek gelecekteki reset'lerde de
 * renk swap'ının otomatik uygulanmasını sağlar.
 *
 * Sorun: cubing.js, stickering mask uygulanırken resetSVG() çağırıyor
 * ve yeni bir svgWrapper oluşturuyor. Bu bizim yamalamızı siliyor.
 * Monkey-patch ile her resetSVG çağrısından sonra otomatik yeniden yamalarız.
 */
function patchOriginalColors(
    container: HTMLElement,
    colorSwapMap: Map<string, string>
): boolean {
    const puzzle2D = findPuzzle2D(container);
    if (!puzzle2D) return false;

    const svgWrapper = (puzzle2D as any).svgWrapper;
    if (!svgWrapper?.originalColors) return false;

    // Mevcut originalColors'ı swap et
    swapColorsInDict(svgWrapper.originalColors, colorSwapMap);

    // Mevcut stop elementlerini güncelle (anlık görsel)
    updateStopElements(puzzle2D, colorSwapMap);

    // resetSVG'yi monkey-patch et — gelecekteki reset'lerde de otomatik swap
    if (!(puzzle2D as any).__colorSwapPatched) {
        const origResetSVG = (puzzle2D as any).resetSVG;
        (puzzle2D as any).resetSVG = function (this: any, ...args: any[]) {
            origResetSVG.apply(this, args);
            if (this.svgWrapper?.originalColors) {
                swapColorsInDict(this.svgWrapper.originalColors, colorSwapMap);
                // resetSVG içinde draw() çağrılıyor ama eski renklerle —
                // stop elementlerini de güncelle
                const shadow = getShadow(this);
                if (shadow) {
                    const stops = shadow.querySelectorAll('stop');
                    for (const stop of Array.from(stops)) {
                        const cur = stop.getAttribute('stop-color');
                        if (cur && colorSwapMap.has(cur)) {
                            stop.setAttribute('stop-color', colorSwapMap.get(cur)!);
                        }
                    }
                }
            }
        };
        (puzzle2D as any).__colorSwapPatched = true;
    }

    return true;
}

/**
 * TwistyPlayer render edildikten sonra renk değişimi yapar.
 * Hem originalColors sözlüğünü (kalıcı) hem de <stop> elementlerini günceller.
 * resetSVG'yi monkey-patch ederek gelecekteki reset'lerde de swap'ı korur.
 *
 * Başarılıysa true döner — çağıran taraf retry'ı durdurabilir.
 */
export function applyOLLColorSwap(
    container: HTMLElement,
    colorSwapMap: Map<string, string>
): boolean {
    if (!colorSwapMap || colorSwapMap.size === 0) return true;

    return patchOriginalColors(container, colorSwapMap);
}

