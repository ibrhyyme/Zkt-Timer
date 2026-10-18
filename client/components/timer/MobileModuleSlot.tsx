import React, { useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useIsomorphicLayoutEffect from '../../util/hooks/useIsomorphicLayoutEffect';
import { TimerModuleType } from './@types/enums';
import ModuleBody, { MODULE_LABEL_KEYS } from './module_registry';
import {
    dragOffset,
    isSwipeTarget,
    lockAxis,
    neighbourModule,
    settleSwipe,
    slotPages,
    SwipeTargetEnv,
} from './helpers/module_carousel';
import { inReversedFrame, orientDelta } from '../../util/reversed-ui';
import block from '../../styles/bem';
import './MobileModuleSlot.scss';

const b = block('mobile-module-slot');

// Same strip KeyWatcher leaves to the edge drawers' notches and the system back gesture.
const EDGE_ZONE_PX = 20;
// Length of the page turn and of the spring back.
const TURN_MS = 180;
// How long the dots stay fully opaque after a turn before they settle to half (K-4).
const DOTS_REST_MS = 900;
// A finger that stood still this long before lifting has no flick speed left.
const STALE_VELOCITY_MS = 80;

const domSwipeEnv: SwipeTargetEnv = {
    scrollsX(node: any) {
        if (typeof window === 'undefined' || !(node instanceof Element)) return false;
        const overflow = window.getComputedStyle(node).overflowX;
        return (overflow === 'auto' || overflow === 'scroll') && node.scrollWidth > node.clientWidth + 1;
    },
};

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

interface Props {
    /** 0 is the left slot, 1 the right one. Places the slot and its dots in the dashboard grid. */
    slot: 0 | 1;
    moduleType: TimerModuleType;
    /** What the other slot shows. This slot never pages onto it (feedback 1.8-i). */
    otherModule: TimerModuleType;
    onChange: (next: TimerModuleType) => void;
}

interface Gesture {
    x: number;
    y: number;
    lastX: number;
    lastT: number;
    velocity: number;
    dx: number;
    axis: 'x' | 'y' | null;
    reversed: boolean;
}

/**
 * One of the phone's two module slots. A horizontal swipe on the module itself turns to
 * the next or previous mobile module (feedback 1.8-h, decision K-4); a vertical one is
 * left to the module, so the solves list keeps scrolling. The dots under the slot show
 * where it is: fully visible while paging, half transparent at rest (1.8-j). A swipe
 * along the dots pages too (owner, 2026-10-13): the scramble preview is almost all 3D
 * cube, which turns under the finger instead of paging.
 *
 * The drag is drawn by writing the transform straight onto the track, not through React
 * state: a re-render per touchmove would re-render the solves list with it.
 */
export default function MobileModuleSlot({ slot, moduleType, otherModule, onChange }: Props) {
    const { t } = useTranslation();

    const frameRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const dotsRef = useRef<HTMLButtonElement>(null);
    // The neighbour that slides in alongside the page while it is dragged.
    const [peek, setPeek] = useState<{ module: TimerModuleType; side: 1 | -1 } | null>(null);
    const [entering, setEntering] = useState(false);
    const [dotsLive, setDotsLive] = useState(false);

    const dotsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Dots go fully visible while paging and back to half a moment after it.
    function wakeDots() {
        if (dotsTimer.current) clearTimeout(dotsTimer.current);
        dotsTimer.current = null;
        setDotsLive(true);
    }

    function restDots() {
        if (dotsTimer.current) clearTimeout(dotsTimer.current);
        dotsTimer.current = setTimeout(() => setDotsLive(false), DOTS_REST_MS);
    }

    useEffect(() => () => {
        if (dotsTimer.current) clearTimeout(dotsTimer.current);
    }, []);

    const latest = useRef({ moduleType, otherModule, onChange, wakeDots, restDots });
    latest.current = { moduleType, otherModule, onChange, wakeDots, restDots };

    useEffect(() => {
        const frame = frameRef.current;
        const dots = dotsRef.current;
        if (!frame) return undefined;

        let gesture: Gesture | null = null;
        let turning = false;
        const timers = new Set<ReturnType<typeof setTimeout>>();

        function later(fn: () => void, ms: number) {
            const id = setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.add(id);
        }

        function neighbours() {
            const { moduleType: current, otherModule: other } = latest.current;
            return {
                previous: neighbourModule(current, other, -1),
                next: neighbourModule(current, other, 1),
            };
        }

        function paint(offset: number, animate: boolean) {
            const track = trackRef.current;
            if (!track) return;
            track.style.transition = animate ? `transform ${TURN_MS}ms ease-out` : 'none';
            track.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : '';
        }

        // A swipe that started on a row or its delete button must not also tap it, and one
        // along the dots must not also step a page from their tap handler.
        function swallowNextClick() {
            const swallow = (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
            };
            const targets = dots ? [frame, dots] : [frame];
            targets.forEach((target) => target.addEventListener('click', swallow, true));
            later(() => targets.forEach((target) => target.removeEventListener('click', swallow, true)), 400);
        }

        function springBack() {
            paint(0, !prefersReducedMotion());
            later(() => setPeek(null), TURN_MS);
            latest.current.restDots();
        }

        // `onDots`: the swipe started on the page dots. Nothing there owns a drag (no 3D
        // cube, no list), so it always pages; it is the easy way to page a module whose
        // own surface is mostly a gesture, like the scramble preview's cube.
        function begin(event: TouchEvent, onDots: boolean) {
            if (event.touches.length !== 1) {
                if (gesture?.axis === 'x') springBack();
                gesture = null;
                return;
            }
            if (turning) return;

            const touch = event.touches[0];
            if (touch.clientX < EDGE_ZONE_PX || window.innerWidth - touch.clientX < EDGE_ZONE_PX) return;
            if (!onDots && !isSwipeTarget(event.target, frame, domSwipeEnv)) return;

            gesture = {
                x: touch.clientX,
                y: touch.clientY,
                lastX: touch.clientX,
                lastT: event.timeStamp,
                velocity: 0,
                dx: 0,
                axis: null,
                reversed: inReversedFrame(frame),
            };
        }

        function onMove(event: TouchEvent) {
            if (!gesture) return;
            const touch = event.touches[0];
            if (!touch) return;

            const [dx, dy] = orientDelta(touch.clientX - gesture.x, touch.clientY - gesture.y, gesture.reversed);

            if (!gesture.axis) {
                gesture.axis = lockAxis(dx, dy);
                if (!gesture.axis) return;
                if (gesture.axis === 'y') {
                    // A scroll: the module keeps it.
                    gesture = null;
                    return;
                }
                latest.current.wakeDots();
            }

            // The finger is paging; the list under it must not scroll along.
            if (event.cancelable) event.preventDefault();

            const dt = event.timeStamp - gesture.lastT;
            if (dt > 0) {
                const [stepX] = orientDelta(touch.clientX - gesture.lastX, 0, gesture.reversed);
                gesture.velocity = 0.8 * (stepX / dt) + 0.2 * gesture.velocity;
                gesture.lastX = touch.clientX;
                gesture.lastT = event.timeStamp;
            }
            gesture.dx = dx;

            const { previous, next } = neighbours();
            const side: 1 | -1 = dx < 0 ? 1 : -1;
            const incoming = side === 1 ? next : previous;
            setPeek((current) =>
                incoming
                    ? current && current.module === incoming && current.side === side
                        ? current
                        : { module: incoming, side }
                    : null
            );
            paint(dragOffset(dx, !!previous, !!next), false);
        }

        function onEnd(event: TouchEvent) {
            if (!gesture) return;
            const ended = gesture;
            gesture = null;
            if (ended.axis !== 'x') return;

            swallowNextClick();

            const { previous, next } = neighbours();
            const width = frame.clientWidth || 1;
            const velocity = event.timeStamp - ended.lastT > STALE_VELOCITY_MS ? 0 : ended.velocity;
            const turn = settleSwipe(ended.dx, velocity, width, !!previous, !!next);
            const target = turn === 1 ? next : turn === -1 ? previous : null;

            if (!turn || !target) {
                springBack();
                return;
            }

            // One render for the whole swap (React 17 does not batch inside a timeout). The
            // placeholder stays up until the new module has mounted (layout effect below),
            // so no frame shows an empty slot even if the setting lands a tick later.
            const commit = () => {
                turning = false;
                unstable_batchedUpdates(() => {
                    setEntering(true);
                    latest.current.onChange(target);
                    latest.current.restDots();
                });
                // Should the write not go through, bring the page back rather than leave
                // the slot showing a placeholder.
                later(() => {
                    if (!gesture && latest.current.moduleType !== target) {
                        paint(0, false);
                        setPeek(null);
                    }
                }, 300);
            };

            if (prefersReducedMotion()) {
                commit();
                return;
            }

            // Finish the turn: the page leaves, the neighbour's placeholder takes the slot,
            // then the module itself mounts there.
            turning = true;
            paint(-turn * width, true);
            later(commit, TURN_MS);
        }

        function onCancel() {
            if (gesture?.axis === 'x') springBack();
            gesture = null;
        }

        const onFrameStart = (event: TouchEvent) => begin(event, false);
        const onDotsStart = (event: TouchEvent) => begin(event, true);

        frame.addEventListener('touchstart', onFrameStart, { passive: true });
        // Not passive: a horizontal swipe has to stop the list under it from scrolling.
        frame.addEventListener('touchmove', onMove, { passive: false });
        frame.addEventListener('touchend', onEnd);
        frame.addEventListener('touchcancel', onCancel);

        // The dots drive the same gesture: the page follows the finger as it would on the
        // module itself.
        if (dots) {
            dots.addEventListener('touchstart', onDotsStart, { passive: true });
            dots.addEventListener('touchmove', onMove, { passive: false });
            dots.addEventListener('touchend', onEnd);
            dots.addEventListener('touchcancel', onCancel);
        }

        return () => {
            frame.removeEventListener('touchstart', onFrameStart);
            frame.removeEventListener('touchmove', onMove);
            frame.removeEventListener('touchend', onEnd);
            frame.removeEventListener('touchcancel', onCancel);
            if (dots) {
                dots.removeEventListener('touchstart', onDotsStart);
                dots.removeEventListener('touchmove', onMove);
                dots.removeEventListener('touchend', onEnd);
                dots.removeEventListener('touchcancel', onCancel);
            }
            timers.forEach((id) => clearTimeout(id));
        };
    }, []);

    // A new module starts from a clean track: the old one was left translated off screen.
    // Layout effect, so the new module is never painted off screen for a frame.
    useIsomorphicLayoutEffect(() => {
        setPeek(null);
        const track = trackRef.current;
        if (!track) return;
        track.style.transition = 'none';
        track.style.transform = '';
    }, [moduleType]);

    const pages = slotPages(otherModule);
    const pageIndex = Math.max(0, pages.indexOf(moduleType));
    const label = (module: TimerModuleType) => t(MODULE_LABEL_KEYS[module] || 'timer_modules.none');

    // Tapping the dots turns one page toward the side tapped, like the iOS page control.
    // It is also the way to change modules without a swipe (keyboard, screen reader).
    function stepFromDots(event: React.MouseEvent<HTMLButtonElement>) {
        const rect = event.currentTarget.getBoundingClientRect();
        let direction: 1 | -1 = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
        if (inReversedFrame(event.currentTarget)) direction = direction === 1 ? -1 : 1;
        // A keyboard press has no position: go forward, and from the last page back to the first.
        if (event.detail === 0) direction = 1;
        const target =
            neighbourModule(moduleType, otherModule, direction) ??
            (event.detail === 0 ? pages[0] : null);
        if (!target || target === moduleType) return;
        setEntering(true);
        onChange(target);
        wakeDots();
        restDots();
    }

    const gridColumn = slot + 1;

    return (
        <>
            <div ref={frameRef} className={b()} style={{ gridColumn, gridRow: 1 }}>
                <div ref={trackRef} className={b('track')}>
                    <div
                        key={moduleType}
                        className={b('page', { scramble: moduleType === TimerModuleType.SCRAMBLE, entering })}
                        onAnimationEnd={() => setEntering(false)}
                    >
                        {/* The same body the desktop tiles draw (module_registry), so the phone
                            cannot drift from it: it had its own switch that left out the
                            scramble subset, and Diamond (dmdso) was drawn as an FTO (E-18). */}
                        <ModuleBody moduleType={moduleType} />
                    </div>
                    {peek && (
                        <div className={b('peek', { side: peek.side === 1 ? 'next' : 'previous' })} aria-hidden="true">
                            {label(peek.module)}
                        </div>
                    )}
                </div>
            </div>

            <button
                ref={dotsRef}
                type="button"
                className={b('dots', { live: dotsLive })}
                style={{ gridColumn, gridRow: 2 }}
                onClick={stepFromDots}
                aria-label={t('mobile_modules.page_label', {
                    slot: t(slot === 0 ? 'mobile_modules.slot_left' : 'mobile_modules.slot_right'),
                    module: label(moduleType),
                    index: pageIndex + 1,
                    count: pages.length,
                })}
            >
                {pages.map((page, index) => (
                    <span key={page} className={b('dot', { current: index === pageIndex })} />
                ))}
            </button>
        </>
    );
}
