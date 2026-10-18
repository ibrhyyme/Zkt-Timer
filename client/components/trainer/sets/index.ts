/**
 * Algorithm set screens, as the trainer shell (Trainer.tsx) imports them (trainer-sets 10, T3/T5/T6).
 *
 * OWNERSHIP: T3 opened this file with empty placeholders so the shell, the routes and the tabs
 * could land first. From here on it belongs to T5 (MySets, CommunitySets, AlgSetPage) and T6
 * (SetPicker): they replace the placeholders with their components and only touch this file and
 * their own folders, never Trainer.tsx.
 *
 * Contract with the shell:
 * - MySets, CommunitySets and AlgSetPage render inside the shell's scroll container
 *   (`zt-trainer-hub__scroll`), below the header. My Sets has the Community Sets entry
 *   (CommunityBanner) above it.
 *   SetPicker gets a non scrolling flex column (`zt-trainer-hub__pane`, flex: 1) and owns its own
 *   scrolling, so its selection bar can stay at the bottom. None of them locks or scrolls the body.
 * - The header (TrainerToolbar) is drawn by the shell: back goes Community Sets → My Sets,
 *   set page → My Sets or Community Sets, picker → set page, My Sets → hub.
 * - The set code of AlgSetPage / SetPicker comes from the URL (`parseSetPath(location.pathname)`).
 * - CommunitySets and AlgSetPage also render for a signed-out visitor (2.4); their own Study and
 *   Save buttons send to `/login?redirect=<address>`. MySets and SetPicker only render signed in.
 * - The set page draws its own study mode switch next to "Study" (hub/StudyModeSwitch, `block`).
 */
export {default as MySets} from './MySets';
export {default as CommunitySets} from './CommunitySets';
export {default as AlgSetPage} from './AlgSetPage';
export {default as SetPicker} from './picker/SetPicker';
export {default as CommunityBanner} from './CommunityBanner';
