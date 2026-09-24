import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../hooks/usePresence';
import { useInViewPause } from '../../hooks/useInViewPause';

// ─────────────────────────────────────────────────────────────────────────
// SystemNotification — Solo-Leveling "The System" ornate panel.
// Wholesale ported to the .sys-frame design language from
// .design-reference/system-notification-frame.html.
//
// Structure (per canonical reference HTML):
//   .sys-frame
//     ├─ 4× <span.corner corner-{tl,tr,br,bl}> with <use href="#sys-filigree" />
//     ├─ optional .sys-close (top-right, when closable=true && onClose)
//     ├─ .sys-head
//     │     ├─ .sys-title-wrap → .sys-title (title) + .sys-subtitle (subtitle)
//     │     └─ optional cta slot (e.g., .sys-cta pill)
//     ├─ .sys-divider → 2× .sys-divider-line + 1× .sys-gem
//     ├─ .sys-body { children }
//     └─ optional .sys-footer { footer }
//
// IMPORTANT: <SystemFrameDefs /> MUST be mounted once in the document
// (Layout mounts it for the app shell; the intro stage in App.tsx mounts
// its own copy because it renders outside Layout) so the
// <use href="#sys-filigree" /> references resolve to the corner ornament.
//
// Two render modes:
//   - mode='modal'  (default) — full-viewport backdrop + centered .sys-frame,
//                                driven by `open`. Portaled to <body> so an
//                                ancestor transform can never trap the fixed
//                                overlay. Materializes in AND dematerializes
//                                out (usePresence keeps it mounted for the
//                                exit), Esc closes it when closable.
//   - mode='inline' — .sys-frame in document flow, ignores `open`
// ─────────────────────────────────────────────────────────────────────────

export type SystemNotificationTone = 'cyan' | 'gold' | 'red';
export type SystemNotificationMode = 'modal' | 'inline';

export interface SystemNotificationProps {
    /** Modal-mode only — controls mount/unmount lifecycle. Ignored when mode='inline'. */
    open?: boolean;
    mode?: SystemNotificationMode;
    title?: string;
    subtitle?: string;
    children?: ReactNode;
    onClose?: () => void;
    /** Theming. Default `'cyan'`. */
    tone?: SystemNotificationTone;
    /** Show the close (X) button (top-right). Default true. */
    closable?: boolean;
    /** Optional right-edge slot in .sys-head — e.g., an "Evaluate Now" CTA pill. */
    cta?: ReactNode;
    /** Optional footer content (rendered below body). */
    footer?: ReactNode;
    className?: string;
}

// Must cover the CSS exit (.sys-modal-root[data-state="exit"], --dur-2).
const EXIT_MS = 200;

/** 4× ornate corner filigree referencing the global <symbol id="sys-filigree" />. */
function Corners() {
    return (
        <>
            <span className="sys-corner sys-corner-tl"><svg><use href="#sys-filigree" /></svg></span>
            <span className="sys-corner sys-corner-tr"><svg><use href="#sys-filigree" /></svg></span>
            <span className="sys-corner sys-corner-br"><svg><use href="#sys-filigree" /></svg></span>
            <span className="sys-corner sys-corner-bl"><svg><use href="#sys-filigree" /></svg></span>
        </>
    );
}

/** Gem-centered horizontal divider that sits between head and body. */
function Divider() {
    return (
        <div className="sys-divider" aria-hidden="true">
            <span className="sys-divider-line" />
            <span className="sys-gem" />
            <span className="sys-divider-line" />
        </div>
    );
}

function FrameContent({
    title,
    subtitle,
    titleId,
    children,
    footer,
    closable,
    onClose,
    cta,
}: Pick<SystemNotificationProps,
    'title' | 'subtitle' | 'children' | 'footer' | 'closable' | 'onClose' | 'cta'
> & { titleId?: string }) {
    const hasHead = !!(title || subtitle || cta);
    return (
        <>
            <Corners />

            {closable && onClose && (
                <button className="sys-close" onClick={onClose} aria-label="Tutup notifikasi" type="button">
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>
            )}

            {hasHead && (
                <header className="sys-head">
                    {(title || subtitle) && (
                        <div className="sys-title-wrap">
                            {title    && <h2 className="sys-title" id={titleId}>{title}</h2>}
                            {subtitle && <p  className="sys-subtitle">{subtitle}</p>}
                        </div>
                    )}
                    {cta}
                </header>
            )}

            {hasHead && <Divider />}

            <div className="sys-body">{children}</div>

            {footer && <div className="sys-footer">{footer}</div>}
        </>
    );
}

export default function SystemNotification({
    open = true,
    mode = 'modal',
    title,
    subtitle,
    children,
    onClose,
    tone = 'cyan',
    closable = true,
    cta,
    footer,
    className = '',
}: SystemNotificationProps) {
    // Hooks must run unconditionally — inline mode simply never opens the
    // presence machine.
    const isModal = mode !== 'inline';
    const { mounted, state } = usePresence(isModal && open, EXIT_MS);
    const titleId = useId();
    const frameRef = useRef<HTMLElement>(null);
    const inlineRef = useRef<HTMLElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // Inline frames (Dashboard verdict) sit in long scrolling pages: stop the
    // breathing glow while they're off screen.
    useInViewPause(inlineRef);

    // Esc dismisses a closable modal, matching the backdrop tap.
    useEffect(() => {
        if (!isModal || !open || !closable) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isModal, open, closable]);

    // Move focus onto the frame itself (not the first input — that would pop
    // the phone keyboard over the quest list) and hand it back on close.
    useEffect(() => {
        if (!isModal || !open) return;
        const restore = document.activeElement as HTMLElement | null;
        // The frame may mount one render after `open` flips (usePresence), so
        // retry for a couple of frames instead of assuming it exists already.
        let tries = 0;
        let id = 0;
        const focusFrame = () => {
            if (frameRef.current) frameRef.current.focus({ preventScroll: true });
            else if (tries++ < 3) id = window.requestAnimationFrame(focusFrame);
        };
        id = window.requestAnimationFrame(focusFrame);
        return () => {
            window.cancelAnimationFrame(id);
            if (restore && document.contains(restore)) restore.focus?.({ preventScroll: true });
        };
    }, [isModal, open]);

    const toneClass = tone === 'cyan' ? '' : `tone-${tone}`;

    if (!isModal) {
        return (
            <section ref={inlineRef} className={`sys-frame ${toneClass} ${className}`.trim()}>
                <FrameContent
                    title={title}
                    subtitle={subtitle}
                    closable={closable}
                    onClose={onClose}
                    cta={cta}
                    footer={footer}
                >
                    {children}
                </FrameContent>
            </section>
        );
    }

    // Modal mode: full-viewport overlay with materialize/dematerialize.
    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(
        <div
            className={`sys-modal-root ${state === 'enter' ? 'is-open' : ''} ${className}`.trim()}
            data-state={state}
        >
            <div
                className="sys-modal-backdrop"
                onClick={closable ? onClose : undefined}
                aria-hidden="true"
            />
            <section
                ref={frameRef}
                className={`sys-frame sys-frame-modal ${toneClass}`.trim()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                tabIndex={-1}
            >
                <FrameContent
                    title={title}
                    subtitle={subtitle}
                    titleId={titleId}
                    closable={closable}
                    onClose={onClose}
                    cta={cta}
                    footer={footer}
                >
                    {children}
                </FrameContent>
            </section>
        </div>,
        document.body,
    );
}
