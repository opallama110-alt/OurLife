import { ReactNode, useEffect, useState } from 'react';

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
// (we do this inside <Layout />) so the <use href="#sys-filigree" />
// references resolve to the gradient-stroked corner ornament.
//
// Two render modes:
//   - mode='modal'  (default) — full-viewport backdrop + centered .sys-frame,
//                                driven by `open` for mount/close transitions
//   - mode='inline' — .sys-frame in document flow, ignores `open`
//
// The modal mount state machine (requestAnimationFrame → setShow(true) →
// setTimeout(unmount, 360)) is preserved from the previous .sn-* version
// so existing modal callers keep their transition timing.
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
    children,
    footer,
    closable,
    onClose,
    cta,
}: Pick<SystemNotificationProps,
    'title' | 'subtitle' | 'children' | 'footer' | 'closable' | 'onClose' | 'cta'
>) {
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
                            {title    && <h2 className="sys-title">{title}</h2>}
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
    // Hooks must run unconditionally — both branches use the same state machine
    // even though inline mode ignores it at render time.
    const [mounted, setMounted] = useState(mode === 'inline' ? true : false);
    const [show, setShow] = useState(mode === 'inline' ? true : false);

    useEffect(() => {
        if (mode === 'inline') return;
        if (open) {
            setMounted(true);
            const id = requestAnimationFrame(() => setShow(true));
            return () => cancelAnimationFrame(id);
        }
        setShow(false);
        const t = window.setTimeout(() => setMounted(false), 360);
        return () => window.clearTimeout(t);
    }, [open, mode]);

    const toneClass = tone === 'cyan' ? '' : `tone-${tone}`;

    if (mode === 'inline') {
        return (
            <section className={`sys-frame ${toneClass} ${className}`.trim()}>
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

    // Modal mode: full-viewport overlay with mount/close transitions.
    if (!mounted) return null;
    return (
        <div className={`sys-modal-root ${show ? 'is-open' : ''} ${className}`.trim()}>
            <div className="sys-modal-backdrop" onClick={closable ? onClose : undefined} />
            <section className={`sys-frame sys-frame-modal ${toneClass}`.trim()}>
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
        </div>
    );
}
