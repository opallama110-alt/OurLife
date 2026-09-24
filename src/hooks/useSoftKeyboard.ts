import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// useSoftKeyboardOpen — best-effort "is the on-screen keyboard up?" signal
// for chrome that should get out of the way while the user types (the
// floating bottom nav would otherwise ride on top of the keyboard, covering
// the very field being edited).
//
// There is no keyboard API that works on both platforms, so two signals are
// combined:
//   1. Focus — a text-entry element focused on a touch-primary device. This
//      fires before the keyboard animates in, so the nav leaves in step with
//      it instead of first being pushed up by the shrinking viewport.
//   2. Viewport height — the visual viewport shrinks by the keyboard height
//      (iOS always; Android with interactive-widget=resizes-content). Once a
//      shrink has been seen, the viewport is trusted: if it grows back while
//      the field is still focused (Android back gesture / iOS "Done"), the
//      keyboard is gone and the nav returns.
// If no shrink shows up within KEYBOARD_GRACE_MS of focus (hardware
// keyboard, or a programmatic focus that iOS refuses to raise a keyboard
// for), the nav comes back instead of staying hidden. Any tap also
// re-checks: browsers fire no focusout when a focused field is unmounted
// (e.g. its sheet closes), so a stale "focused" state can't strand the nav.
// ─────────────────────────────────────────────────────────────────────────

/** Minimum viewport shrink (CSS px) that counts as a keyboard rather than a URL bar. */
const KEYBOARD_MIN_PX = 120;
/** How long a focused field may wait for the keyboard before we assume none is coming. */
const KEYBOARD_GRACE_MS = 700;

/** Input types that open a picker (or nothing) instead of a text keyboard. */
const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
    'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week',
]);

function opensKeyboard(el: Element | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
        return !NON_TEXT_INPUT_TYPES.has(el.type) && !el.readOnly && !el.disabled;
    }
    return el.isContentEditable;
}

export function useSoftKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const coarse = typeof window.matchMedia === 'function'
            ? window.matchMedia('(pointer: coarse)')
            : null;
        const vv = window.visualViewport ?? null;
        // Unscaled on-screen height, so a pinch-zoom doesn't read as a keyboard.
        const screenHeight = () => (vv ? vv.height * vv.scale : window.innerHeight);

        let baseline = screenHeight();
        let baselineWidth = window.innerWidth;
        let keyboardSeen = false;
        let graceExpired = false;
        let graceTimer = 0;
        let raf = 0;

        const clearGrace = () => {
            if (graceTimer) window.clearTimeout(graceTimer);
            graceTimer = 0;
        };

        const evaluate = () => {
            raf = 0;
            const h = screenHeight();
            if (window.innerWidth !== baselineWidth) {
                // Rotation: the old baseline belongs to the other orientation.
                baselineWidth = window.innerWidth;
                baseline = h;
            }
            const focused = !!coarse?.matches && opensKeyboard(document.activeElement);
            if (!focused) {
                // Max, not latest: resize events keep arriving while the
                // keyboard animates down after blur.
                baseline = Math.max(baseline, h);
                keyboardSeen = false;
                graceExpired = false;
                clearGrace();
                setOpen(false);
                return;
            }
            const keyboardUp = baseline - h > KEYBOARD_MIN_PX;
            if (keyboardUp) {
                keyboardSeen = true;
                clearGrace();
            } else if (!keyboardSeen && !graceExpired && !graceTimer) {
                graceTimer = window.setTimeout(() => {
                    graceTimer = 0;
                    graceExpired = true;
                    schedule();
                }, KEYBOARD_GRACE_MS);
            }
            // Before the keyboard has shown up, assume it's on its way —
            // but only for the grace window.
            setOpen(keyboardUp || (!keyboardSeen && !graceExpired));
        };

        // Deferred a frame: moving focus field → field fires focusout before
        // the next focusin, and reading activeElement in between would flash
        // the nav back for one frame. Also coalesces the burst of resize
        // events while the keyboard animates.
        const schedule = () => {
            if (!raf) raf = window.requestAnimationFrame(evaluate);
        };

        document.addEventListener('focusin', schedule);
        document.addEventListener('focusout', schedule);
        document.addEventListener('pointerdown', schedule, true);
        const resizeTarget: EventTarget = vv ?? window;
        resizeTarget.addEventListener('resize', schedule);
        schedule();

        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            clearGrace();
            document.removeEventListener('focusin', schedule);
            document.removeEventListener('focusout', schedule);
            document.removeEventListener('pointerdown', schedule, true);
            resizeTarget.removeEventListener('resize', schedule);
        };
    }, []);

    return open;
}
