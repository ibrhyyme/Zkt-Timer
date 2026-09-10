/**
 * Home viewing angle for the 3D smart-cube views, in degrees.
 *
 * Shared by the timer / friendly-room view (SmartCubeView) and the trainer, which
 * builds its own player. Both apply it to the puzzle rather than the camera (the
 * camera stays at latitude/longitude 0), and both premultiply it last onto the gyro
 * reading, so it acts as a fixed viewpoint the gyro's motion happens inside of.
 *
 * Tilt looks down onto the top face; turn swings the right-hand face into view.
 * 30 / 35 keeps three faces in view. The earlier 15 / 20 showed the front face almost
 * head-on with the top and side reduced to slivers, so the cube read as a flat square.
 */
export const HOME_TILT_DEG = 30;
export const HOME_TURN_DEG = 35;
