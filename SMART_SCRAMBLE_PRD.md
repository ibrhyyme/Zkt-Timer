# Product Requirements Document (PRD): Smart Scramble Correction System

## 1. Executive Summary
The goal is to implement a **Dynamic Smart Scramble Correction** feature for a Rubik's Cube timer application. When a user makes an incorrect move during scrambling, the system should *instantly* and *seamlessly* generate a new scramble path from the current state to the original target state. This prevents the user from having to reverse moves, creating a fluid "flow" state.

## 2. Core Features & User Experience (UX)

### 2.1. Dynamic Correction (The "Flow" State)
- **Behavior:** If the user deviates from the displayed scramble, the system must NOT force them to go back. Instead, it must calculate a new sequence of moves to reach the intended scramble state.
- **Latency:** The correction must appear *instantly* (perceived <50ms).
- **Solver Strategy:**
    - Use a **Hybrid Solver**:
        - **BFS (Breadth-First Search)** for shallow errors (1-4 moves deep). This is instant.
        - **Kociemba Algorithm** (via `cubejs` or similar) for deep deviation.
    - **Performance:** The solver must be "pre-warmed" (initialized) when the component mounts, so the first error doesn't lag.

### 2.2. Visual Feedback (The "Clean Slate" Logic)
- **Correct Moves (Green):** As the user performs correct moves, they turn **GREEN** and stay on screen. Do NOT hide them immediately; the user needs to see their progress.
- **On Correction (Clean Slate):** When an error is confirmed and a correction is generated:
    1.  **Hide** all previous history (the old green moves).
    2.  **Display** only the NEW path (the correction + remaining original moves).
    3.  This prevents confusion by removing the "invalid" history and giving the user a fresh start.
- **No Red Flash:** Do NOT display "Wrong Move" warnings or turn the text red. If a move is wrong, immediately switch to the new path. Red text creates anxiety/friction.

### 2.3. Timer Start Condition
- **Global State Sync:** The newly generated "correction path" must be treated as the **Official Scramble**.
- **Logic:** The Timer's "Can Start" check usually compares `UserMoves` vs `Scramble`. When a correction happens, update the Global Scramble to be `[UserHistory] + [Correction]`. This ensures that when the user finishes the new path, the timer allows them to start.

## 3. Technical Requirements & Logic

### 3.1. Move Matching Logic (Critical)
The system must robustly match User Moves against the Scramble String.
- **Commutativity:** Implementation must respect cube commutativity (e.g., `U D` is the same as `D U`). If the scramble is `U D` and user does `D`, it is NOT wrong. Wait for `U`.
- **Double Move Splitting (R2 Handling):**
    - `R2` physically consists of two 90-degree turns (`R` + `R`).
    - The matcher must split expected `R2` into `['R', 'R']`.
    - **Scenario:** Scramble has `R2`. User does `R`.
        - System matches the first `R`. Status: "Half/Pending". (Color: Orange).
    - **Scenario:** Scramble has `R2`. User does `R` then `L`.
        - System expects second `R`. User did `L`.
        - **Result:** WRONG. Trigger correction.
    - *Why?* Without splitting, the system might ignore the interleaved `L` or fail to detect that `R2` wasn't finished.

### 3.2. Move Compression (SkipCompress)
- **Requirement:** When tracking user history for the "Corrected Scramble", do NOT compress moves (e.g., do not turn `L L'` into nothing).
- **Reasoning:** If the user makes a mistake and corrects it, that "mistake + correction" is part of the physical history. The Global Scramble must include this full history so the final state check (`UserTurns == Scramble`) passes.

### 3.3. Dependencies
- **Solver:** `cubejs` (lightweight, works well in browser). Alternative: `cubing.js` (heavier but standard).
- **State Management:** React Context / Redux to propagate the 'New Scramble' to the Timer's start logic.

## 4. Edge Cases to Handle
1.  **Interleaved Moves:** User starts `R2`, does `L`, then finishes `R`. (Logic should flag error on `L`).
2.  **Rapid Turns:** Debounce the solver (e.g., 50ms) to prevent freezing UI during speed-turning.
3.  **Race Conditions:** Ensure local visual state doesn't get overwritten by old global state (React `useEffect` dependency management).

## 5. Summary of Algorithm
1.  **Input:** `ExpectedMoves`, `UserMoves`.
2.  **Match:** Compare arrays. Handle Commutativity. Split Double Moves.
3.  **If Mismatch:**
    a. Calculate `TargetState` (from original scramble).
    b. Calculate `CurrentState` (from user moves).
    c. Solve `CurrentState` -> `TargetState`.
    d. `NewScramble` = `UserMoves` + `Solution`.
    e. Update UI: Hide old moves (`resetIndex = currentLength`). Show `Solution`.
    f. Update Global Scramble: Set `scramble = NewScramble`.
4.  **If Match:** Mark moves green.

---
**Prepared by:** Antigravity (Senior Full Stack Agent)
**Date:** 2026-02-04
**For:** Zkt-Timer Project Refactoring
