import Cube from 'cubejs';
import { SmartTurn, processSmartTurns } from '../smart_scramble';
import { getLLState, reverseTurns } from './turns';
import { getMatchingOLLState, getMatchingPLLState } from './ll_states';

export interface LiveAnalysisResult {
    steps: any; // The raw steps object
    currentPhase: 'Cross' | 'F2L' | 'F2L (1)' | 'F2L (2)' | 'F2L (3)' | 'F2L (4)' | 'OLL' | 'PLL' | 'Solved' | 'Scramble/Inspection';
    crossSolved: boolean;
    f2lCount: number; // 0-4
    ollIdentified?: string;
    pllIdentified?: string;
    isSolved: boolean;
    lastStepTime?: number;
    scrambleError?: boolean;
    times: {
        cross?: number;
        f2l?: number;
        f2l_pairs?: (number | undefined)[];
        oll?: number;
        oll_eo?: number; // Edge Orientation (2-look OLL part 1)
        pll?: number;
        pll_cp?: number; // Corner Permutation (2-look PLL part 1)
        total?: number;
    };
}

export function analyzeCurrentState(turns: SmartTurn[], startState?: string): LiveAnalysisResult {
    const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
    const cubejs = startState ? Cube.fromString(startState) : new Cube();


    // We assume startState is the "Scrambled State".
    // No need to apply scramble moves manually.

    // Debug: If cube checks as solved here, it means we started solved.
    // If user is solving, this shouldn't happen unless they solved it instantly or startState is wrong.
    const initiallySolved = isSolved(cubejs.asString());
    // (Optional logic to flag error could go here)

    // reverseTurns(cubejs, turns); // REMOVED: This assumed end state matches solved.

    const sideIndex = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
    const sideOpposites = { U: 'D', L: 'R', R: 'L', D: 'U', F: 'B', B: 'F' };

    // ... (Constants from solve_method.ts) ...
    const cornerIndices = [0, 2, 6, 8];
    const edgeIndices = [1, 3, 5, 7];
    // Simplifying constants for brevity - relying on the fact that I need to copy them fully for it to work.
    // I will copy the minimal set needed for 'areEdgesSolved' etc.

    const cornerAdjSide = {
        U: { 0: ['L:0', 'B:2'], 2: ['B:0', 'R:2'], 6: ['L:2', 'F:0'], 8: ['F:2', 'R:0'] },
        R: { 0: ['F:2', 'U:8'], 2: ['U:2', 'B:0'], 6: ['F:8', 'D:2'], 8: ['D:8', 'B:6'] },
        L: { 0: ['U:6', 'B:2'], 2: ['U:8', 'F:0'], 6: ['B:8', 'D:0'], 8: ['F:6', 'D:2'] },
        F: { 0: ['L:2', 'U:6'], 2: ['U:8', 'R:0'], 6: ['L:8', 'D:0'], 8: ['D:2', 'R:6'] },
        D: { 0: ['L:8', 'F:6'], 2: ['F:8', 'R:6'], 6: ['L:6', 'B:8'], 8: ['R:8', 'B:6'] },
        B: { 0: ['R:2', 'U:2'], 2: ['U:0', 'L:0'], 6: ['R:8', 'D:8'], 8: ['L:6', 'D:6'] },
    };
    const edgeAdj = {
        U: { R: 1, F: 1, L: 1, B: 1 },
        R: { U: 5, F: 5, B: 3, D: 5 },
        L: { U: 3, F: 3, D: 3, B: 5 },
        F: { U: 7, R: 3, D: 1, L: 5 },
        D: { R: 7, F: 7, L: 7, B: 7 },
        B: { U: 1, R: 5, D: 7, L: 3 },
    };

    let sides = ['U', 'R', 'F', 'L', 'D', 'B'];
    // Expanded steps to include sub-steps
    const steps = {
        cross: null,
        f2l: null,
        f2l_1: null, f2l_2: null, f2l_3: null, f2l_4: null,
        oll: null,
        oll_eo: null, // Edge Orientation done
        pll: null,
        pll_cp: null // Corner Permutation done
    };
    let stepTurns: string[] = [];

    // Helpers
    function getAbsoluteIndexByLocalIndex(side, localIndex) {
        if (typeof localIndex === 'string') localIndex = parseInt(localIndex);
        return sideIndex[side] * 9 + localIndex;
    }
    function getCenterIndexGivenAnyIndex(absoluteIndex) {
        const firstPieceOfFaceIndex = 9 * Math.floor(absoluteIndex / 9);
        return firstPieceOfFaceIndex + 4;
    }
    function pieceSameAsCenter(absoluteIndex, state) {
        const centerIndex = getCenterIndexGivenAnyIndex(absoluteIndex);
        return state[absoluteIndex] === state[centerIndex];
    }
    function areEdgesOriented(side, state) {
        for (const edgeIndex of edgeIndices) {
            const index = getAbsoluteIndexByLocalIndex(side, edgeIndex);
            if (!pieceSameAsCenter(index, state)) return false;
        }
        return true;
    }
    function areEdgesSolved(side, state) {
        if (!areEdgesOriented(side, state)) return false;
        const keys = Object.keys(edgeAdj[side]);
        for (const key of keys) {
            const index = getAbsoluteIndexByLocalIndex(key, edgeAdj[side][key]);
            if (!pieceSameAsCenter(index, state)) return false;
        }
        return true;
    }

    // ... Copying other required helpers ...
    function getFirstIndexFromSide(side) { return sideIndex[side] * 9; }

    function areCornersOriented(side, state) {
        const firstIndex = getFirstIndexFromSide(side);
        for (const cornerIndex of cornerIndices) {
            const sameAsCenter = pieceSameAsCenter(firstIndex + cornerIndex, state);
            if (!sameAsCenter) return false;
        }
        return true;
    }

    function getEdgeAdjacentOffset(localIndex) {
        if (localIndex === 1 || localIndex === 7) return [-1, 1];
        else if (localIndex === 3 || localIndex === 5) return [-3, 3];
    }

    function areCornersSolved(side, state) {
        for (const cornerIndex of cornerIndices) {
            const cornerAbsoluteIndex = getAbsoluteIndexByLocalIndex(side, cornerIndex);
            const center = getCenterIndexGivenAnyIndex(cornerAbsoluteIndex);

            if (state[center] !== state[cornerAbsoluteIndex]) return false;

            const adjFaces = Object.keys(edgeAdj[side]);

            for (const adjFace of adjFaces) {
                const adjEdgeIndex = edgeAdj[side][adjFace];
                const adjLocalIndex = getAbsoluteIndexByLocalIndex(adjFace, adjEdgeIndex);
                const corners = getEdgeAdjacentOffset(adjEdgeIndex);

                const leftIndex = adjLocalIndex + corners[0];
                const rightIndex = adjLocalIndex + corners[1];

                const leftPiece = state[leftIndex];
                const rightPiece = state[rightIndex];

                if (leftPiece !== rightPiece) return false;
            }
        }
        return true;
    }

    function isFaceSolved(side, state) { return areCornersSolved(side, state) && areEdgesSolved(side, state); }

    function isFaceOriented(side, state) { return areCornersOriented(side, state) && areEdgesOriented(side, state); }

    function getOppositeSide(side) { return sideOpposites[side]; }
    function areOpposites(side1, side2) { return sideOpposites[side1] === side2; }
    function getCenterFromSide(side, state) {
        const first = getFirstIndexFromSide(side);
        return state[getCenterIndexGivenAnyIndex(first)];
    }
    function edgeBetweenCentersSolved(center1, center2, state) {
        const center1Edge = edgeAdj[center1][center2];
        const center1Abs = getAbsoluteIndexByLocalIndex(center2, center1Edge);
        const center2Edge = edgeAdj[center2][center1];
        const center2Abs = getAbsoluteIndexByLocalIndex(center1, center2Edge);
        return pieceSameAsCenter(center1Abs, state) && pieceSameAsCenter(center2Abs, state);
    }
    function areFirstTwoLayersSolved(base, state) {
        const adjs = Object.keys(edgeAdj[base]);
        for (const side of adjs) {
            for (const side2 of adjs) {
                if (side === side2 || areOpposites(side, side2)) continue;
                const sideCenter = getCenterFromSide(side, state);
                const side2Center = getCenterFromSide(side2, state);
                if (!edgeBetweenCentersSolved(sideCenter, side2Center, state)) return false;
            }
        }
        return isFaceSolved(base, state);
    }

    function getCubejsWithUOnTop(base, state) {
        const cj = Cube.fromString(state);
        if (base === 'U') cj.move('x2');
        else if (base === 'R') cj.move('z');
        else if (base === 'L') cj.move("z'");
        else if (base === 'F') cj.move("x'");
        else if (base === 'B') cj.move('x');
        return cj.asString();
    }

    function isSolved(state) { return state === SOLVED_STATE; }

    // --- Main Loop ---
    let f2lCount = 0; // Rough estimation

    // New: Track specific pairs
    let solvedSlotsMask = 0; // Bitmask? Or just count. users might solve in any order. 
    // We just want to know "1st pair done", "2nd pair done" etc.
    // So we just track the COUNT of solved slots.

    for (const [index, turn] of turns.entries()) {
        const move = turn.turn; // turn object from smart_scramble has .turn
        stepTurns.push(move);
        cubejs.move(move);
        const state = cubejs.asString();

        // 1. Check Cross
        for (const side of sides) {
            if (!steps.cross && areEdgesSolved(side, state)) {
                steps.cross = { side, index }; // Simple marker
                sides = [side]; // Lock to this side
            }

            if (steps.cross) {
                // Check F2L Slots
                // Get adjacent faces to the cross side
                const adjs = Object.keys(edgeAdj[side]);
                let currentSolvedSlots = 0;

                // Identify slots by checking adjacent pairs (e.g. F-R, R-B, B-L, L-F)
                // We iterate all unique pairs of adjacent sides that are also adjacent to each other
                const checkedPairs = new Set();

                for (const s1 of adjs) {
                    for (const s2 of adjs) {
                        if (s1 === s2 || areOpposites(s1, s2)) continue;

                        // Check if s1 and s2 are adjacent (share an edge? No, they share a corner on the base)
                        // Actually, just check if s2 is in edgeAdj[s1]
                        // edgeAdj definition: U: {R, F, L, B} -> R is adj to U.
                        // We want "vertical" adjacency. 
                        // If base is D. Adjs are F, R, B, L.
                        // F is adjacent to R.

                        // Simplest way: Check if they are adjacent in the standard sense
                        if (!edgeAdj[s1][s2]) continue;

                        const pairId = [s1, s2].sort().join('');
                        if (checkedPairs.has(pairId)) continue;
                        checkedPairs.add(pairId);

                        // Check Slot (Edge + Corner)
                        const s1Center = getCenterFromSide(s1, state);
                        const s2Center = getCenterFromSide(s2, state);

                        const edgeSolved = edgeBetweenCentersSolved(s1Center, s2Center, state);

                        // Corner Check
                        // Corner is intersection of Base, s1, s2.
                        // We need a robust isCornerSolved(base, s1, s2, state)
                        // Re-using areCornersSolved logic is hard because it iterates all.
                        // Let's implement specific Corner check.

                        // Find corner index common to base, s1, s2
                        // This is tricky without a lookup table. 
                        // BUT: areCornersSolved checks all 4 corners of 'base'.
                        // Maybe we just check how many of the 4 base corners are solved?
                        // AND how many of the vertical edges are solved?
                        // A slot is solved if the corner is solved AND the corresponding vertical edge is solved.

                    }
                }

                // Optimized approach: 
                // A slot is defined by a Base Corner.
                // 1. Iterate 4 corners of Base.
                // 2. If corner is solved, find the 2 adjacent faces (excluding base).
                // 3. Check if the edge between those 2 adjacent faces is solved.

                let slotsFound = 0;
                for (const cornerIndex of cornerIndices) { // 0, 2, 6, 8 of Base
                    const cornerFirstIndex = getFirstIndexFromSide(side);
                    const cornerAbsIndex = cornerFirstIndex + cornerIndex;

                    // Check if corner is solved (matches center)
                    // Note: This only checks orientation on the Base face? 
                    // No, we need full check. 
                    // areCornersSolved checks full orientation.

                    // Let's copy-paste logical check for ONE corner from areCornersSolved
                    const center = getCenterIndexGivenAnyIndex(cornerAbsIndex);
                    if (state[center] !== state[cornerAbsIndex]) continue; // Base sticker match

                    // Check other 2 stickers of the corner
                    // We need to know which faces this corner touches.
                    const adjFaces = Object.keys(edgeAdj[side]); // 4 faces
                    // We need the specific 2 faces for THIS corner.
                    // cornerAdjSide[side][cornerIndex] gives ['L:0', 'B:2'] etc.

                    const adjs = cornerAdjSide[side][cornerIndex]; // e.g. ['F:2', 'R:0']
                    let cornerFullySolved = true;
                    let verticalEdgeFaces = [];

                    for (const adjInfo of adjs) {
                        const [adjFace, adjLocalIdxStr] = adjInfo.split(':');
                        const adjLocalIdx = parseInt(adjLocalIdxStr);
                        const adjAbsIdx = getAbsoluteIndexByLocalIndex(adjFace, adjLocalIdx);
                        const adjCenter = getCenterFromSide(adjFace, state);

                        if (state[adjAbsIdx] !== adjCenter) {
                            cornerFullySolved = false;
                            break;
                        }
                        verticalEdgeFaces.push(adjFace); // e.g. F and R
                    }

                    if (!cornerFullySolved) continue;

                    // Corner is solved. Now check the vertical edge between them.
                    const [f1, f2] = verticalEdgeFaces;
                    const f1Center = getCenterFromSide(f1, state);
                    const f2Center = getCenterFromSide(f2, state);

                    if (edgeBetweenCentersSolved(f1Center, f2Center, state)) {
                        slotsFound++;
                    }
                }

                currentSolvedSlots = slotsFound;
                f2lCount = slotsFound;

                // Record Milestones
                for (let i = 1; i <= 4; i++) {
                    if (currentSolvedSlots >= i && !steps[`f2l_${i}`]) {
                        steps[`f2l_${i}`] = { side, index };
                    }
                }
            }

            if (steps.cross && !steps.f2l && areFirstTwoLayersSolved(side, state)) {
                steps.f2l = { side, index };
            }

            // OLL Check
            const lastLayerSide = getOppositeSide(side);

            // EO Check (Edges Oriented on LL)
            if (steps.f2l && !steps.oll_eo && areEdgesOriented(lastLayerSide, state)) {
                steps.oll_eo = { side, index };
            }

            if (steps.f2l && !steps.oll && isFaceOriented(lastLayerSide, state)) {
                let ollState = getCubejsWithUOnTop(side, getLLState(stepTurns.join(' ')));
                if (lastLayerSide !== 'U') {
                    ollState = ollState.replace(/U/g, 'X');
                    ollState = ollState.replace(new RegExp(lastLayerSide, 'g'), 'U');
                }
                const matchingOll = getMatchingOLLState(ollState);
                steps.oll = { side, index, case: matchingOll?.name, key: matchingOll?.key };
                // If OLL matches, EO must be done too (fallback)
                if (!steps.oll_eo) steps.oll_eo = { side, index };
            }

            // CP Check (Corners Permuted on LL)
            // areCornersSolved checks PERMUTATION too (relative to centers).
            // Actually, areCornersSolved checks if corners are SOLVED (oriented + permuted).
            // We want CP (Permuted) even if not Oriented? No, PLL phase assumes OLL is done (Oriented).
            // So CP means Corners are Solved (since they are already oriented from OLL).

            if (steps.oll) {
                // Check if corners are fully solved (Permuted and Oriented)
                if (!steps.pll_cp && areCornersSolved(lastLayerSide, state)) {
                    steps.pll_cp = { side, index };
                }
            }


            if (steps.oll && !steps.pll && isSolved(state)) {
                const opposite = getOppositeSide(side);
                let pllState = getCubejsWithUOnTop(side, getLLState(stepTurns.join(' ')));
                // PLL Normalization Logic (Simplified for brevity, assuming ll_states handles enough)
                pllState = pllState.replace(new RegExp(side, 'g'), 'X');
                pllState = pllState.replace(new RegExp(opposite, 'g'), 'X');
                // Check existing code for full normalization if matching fails often

                // Re-using the normalization from solve_method checking...
                const uSides = Object.keys(edgeAdj['U']);
                const baseSides = Object.keys(edgeAdj[opposite]);
                for (const [idx, bs] of baseSides.entries()) {
                    pllState = pllState.replace(new RegExp(bs, 'g'), idx.toString());
                }
                for (const [idx, us] of uSides.entries()) {
                    pllState = pllState.replace(new RegExp(String(idx), 'g'), us);
                }

                const matchingPll = getMatchingPLLState(pllState);
                steps.pll = { side, index, case: matchingPll?.name, key: matchingPll?.key };
                // If PLL matches, CP must be done too (fallback)
                if (!steps.pll_cp) steps.pll_cp = { side, index };
                break; // Found OLL
            }
        }
    }

    // Determine current phase based on what's found
    let currentPhase: any = 'Scramble/Inspection';
    if (steps.cross) {
        currentPhase = 'F2L'; // Default
        // Refine F2L sub-phase
        if (steps['f2l_4']) currentPhase = 'OLL';
        else if (steps['f2l_3']) currentPhase = 'F2L (4)';
        else if (steps['f2l_2']) currentPhase = 'F2L (3)';
        else if (steps['f2l_1']) currentPhase = 'F2L (2)';
        else currentPhase = 'F2L (1)';
    }
    if (steps.f2l) currentPhase = 'OLL';
    if (steps.oll) currentPhase = 'PLL';
    if (steps.pll) currentPhase = 'Solved';

    // Calculate Times
    const startTime = turns.length > 0 ? turns[0].time : 0;
    const getStepTime = (step: any, prevTime: number) => {
        if (!step || typeof step.index !== 'number' || !turns[step.index] || !turns[step.index].time) return undefined;
        // Cumulative time from start
        return (turns[step.index].time! - startTime!) / 1000;
    };

    // Total elapsed time so far (last turn)
    const totalTime = turns.length > 0 && turns[turns.length - 1].time ? (turns[turns.length - 1].time! - startTime!) / 1000 : 0;

    const crossTime = getStepTime(steps.cross, 0);
    const f2lTime = getStepTime(steps.f2l, 0); // This is cumulative F2L finish time
    const ollTime = getStepTime(steps.oll, 0);
    const pllTime = getStepTime(steps.pll, 0);

    // New specific times
    const pairTimes = [1, 2, 3, 4].map(i => getStepTime(steps[`f2l_${i}`], 0));

    const eoTime = getStepTime(steps.oll_eo, 0);
    const cpTime = getStepTime(steps.pll_cp, 0);

    return {
        steps,
        currentPhase,
        crossSolved: !!steps.cross,
        f2lCount: f2lCount,
        ollIdentified: steps.oll?.case,
        pllIdentified: steps.pll?.case,
        isSolved: !!steps.pll,
        scrambleError: false,
        times: {
            cross: crossTime,
            f2l: f2lTime,
            f2l_pairs: pairTimes,
            oll: ollTime,
            oll_eo: eoTime,
            pll: pllTime,
            pll_cp: cpTime,
            total: totalTime
        }
    };
}
