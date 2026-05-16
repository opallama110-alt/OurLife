import { ReactNode, useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// SystemNotification — Solo-Leveling-style ornate frame with corner filigree,
// top crown ornament, glowing border, and a "materialize" entrance animation.
//
// Two render modes:
//   - mode='modal'  (default) — full-viewport backdrop + centered panel,
//                                driven by `open` boolean for mount/close.
//   - mode='inline' — panel only, sits in document flow; ignores `open`.
//                     For Dashboard's "The System" verdict card and other
//                     persistent-on-page System pronouncements.
//
// All visual ornamentation (filigree SVGs, crown SVG, sn-materialize, fade-in
// timings) is shared between the two modes via .sn-panel.* selectors.
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
    /** Show the close (X) button. Default true. */
    closable?: boolean;
    footer?: ReactNode;
    className?: string;
}

function CornerFiligree({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
    const transform =
        position === 'tl' ? '' :
        position === 'tr' ? 'scale(-1, 1) translate(-44, 0)' :
        position === 'bl' ? 'scale(1, -1) translate(0, -44)' :
                            'scale(-1, -1) translate(-44, -44)';
    return (
        <svg
            className={`sn-corner sn-corner-${position}`}
            viewBox="0 0 44 44"
            width="44"
            height="44"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`sn-fil-grad-${position}`} x1="0" y1="0" x2="44" y2="44">
                    <stop offset="0%" stopColor="#67E8F9" />
                    <stop offset="60%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
            </defs>
            <g transform={transform} stroke={`url(#sn-fil-grad-${position})`} strokeWidth="1.2" fill="none" strokeLinecap="round">
                <path d="M2 22 V2 H22" strokeWidth="1.8" />
                <path d="M6 22 Q6 16 10 14 Q14 12 14 6" />
                <path d="M10 22 Q12 18 16 18 Q20 18 22 14" />
                <path d="M22 6 Q18 10 22 14" />
                <path d="M2 26 Q4 28 8 28 M2 36 Q6 36 8 32" />
                <path d="M26 2 Q28 4 28 8 M36 2 Q36 6 32 8" />
                <circle cx="22" cy="22" r="1.2" fill="#67E8F9" />
                <circle cx="6" cy="6" r="1.0" fill="#22D3EE" />
            </g>
        </svg>
    );
}

function Crown() {
    return (
        <svg className="sn-crown" viewBox="0 0 160 36" width="160" height="36" aria-hidden="true">
            <defs>
                <linearGradient id="sn-crown-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A5F3FC" />
                    <stop offset="50%" stopColor="#67E8F9" />
                    <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
            </defs>
            <g stroke="url(#sn-crown-grad)" strokeWidth="1.4" fill="none" strokeLinecap="round">
                <path d="M2 24 Q40 22 60 14 Q74 8 80 8" />
                <path d="M158 24 Q120 22 100 14 Q86 8 80 8" />
                <path d="M40 20 Q44 14 50 16" />
                <path d="M120 20 Q116 14 110 16" />
                <path d="M80 0 L84 6 L80 14 L76 6 Z" fill="url(#sn-crown-grad)" stroke="none" />
                <circle cx="80" cy="18" r="2" fill="#A5F3FC" />
                <circle cx="60" cy="14" r="1" fill="#67E8F9" />
                <circle cx="100" cy="14" r="1" fill="#67E8F9" />
            </g>
        </svg>
    );
}

function Divider() {
    return (
        <div className="sn-divider" aria-hidden="true">
            <span className="sn-divider-line" />
            <span className="sn-divider-bead" />
            <span className="sn-divider-line" />
        </div>
    );
}

function PanelContent({
    title,
    subtitle,
    children,
    footer,
    closable,
    onClose,
}: Pick<SystemNotificationProps, 'title' | 'subtitle' | 'children' | 'footer' | 'closable' | 'onClose'>) {
    return (
        <>
            <CornerFiligree position="tl" />
            <CornerFiligree position="tr" />
            <CornerFiligree position="bl" />
            <CornerFiligree position="br" />

            <div className="sn-crown-wrap"><Crown /></div>

            {closable && onClose && (
                <button className="sn-close" onClick={onClose} aria-label="Tutup">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </button>
            )}

            <div className="sn-body">
                {title && <h2 className="sn-title">{title}</h2>}
                {(title || subtitle) && <Divider />}
                {subtitle && <p className="sn-subtitle">{subtitle}</p>}
                {children && <div className="sn-content">{children}</div>}
                {footer && <div className="sn-footer">{footer}</div>}
            </div>
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
    footer,
    className = '',
}: SystemNotificationProps) {
    // Hooks must be called unconditionally — both branches use the same state
    // machine even though inline mode ignores it at render time.
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

    const panel = (
        <PanelContent
            title={title}
            subtitle={subtitle}
            closable={closable}
            onClose={onClose}
            footer={footer}
        >
            {children}
        </PanelContent>
    );

    if (mode === 'inline') {
        return (
            <div className={`sn-panel sn-inline tone-${tone} ${className}`.trim()}>
                {panel}
            </div>
        );
    }

    // Modal mode: full-viewport overlay with mount/close transitions.
    if (!mounted) return null;
    return (
        <div className={`sn-root tone-${tone} ${show ? 'is-open' : ''} ${className}`.trim()}>
            <div className="sn-backdrop" onClick={closable ? onClose : undefined} />
            <div className="sn-panel">{panel}</div>
        </div>
    );
}
