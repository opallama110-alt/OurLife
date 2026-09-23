import React, { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../../hooks/usePresence';

// ─────────────────────────────────────────────────────────────────────────
// HudDialog — the shared modal primitive (centered dialog or bottom sheet)
// in the HUD design language, with a real enter AND exit.
//
// Portaled to <body>: a position:fixed overlay rendered inside a page can be
// trapped by any ancestor that carries a transform (route enter, reveal
// animations) and end up anchored to that card instead of the viewport.
// Esc and backdrop tap close it; focus moves into the dialog on open and
// returns to the trigger on close.
//
// ConfirmDialog builds on it for destructive actions (delete habit, delete
// workout, cancel session…) — Tier 0.6.
// ─────────────────────────────────────────────────────────────────────────

export type HudDialogTone = 'cyan' | 'red' | 'orange' | 'green';

export interface HudDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  tone?: HudDialogTone;
  /** 'center' (default) or a bottom 'sheet'. */
  variant?: 'center' | 'sheet';
  children?: ReactNode;
  footer?: ReactNode;
  /** Disable backdrop/Esc dismissal (e.g. while saving). */
  dismissible?: boolean;
  className?: string;
}

const EXIT_MS = 200;

export default function HudDialog({
  open,
  onClose,
  title,
  subtitle,
  tone = 'cyan',
  variant = 'center',
  children,
  footer,
  dismissible = true,
  className = '',
}: HudDialogProps) {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus in on open, back to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([disabled])');
      (first ?? panel).focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(id);
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`hd-root hd-root--${variant}`} data-state={state}>
      <div
        className="hd-backdrop"
        onClick={() => { if (dismissible) onClose(); }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`hd-panel hd-panel--${tone} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {variant === 'sheet' && <span className="hd-grabber" aria-hidden="true" />}
        <div className="hd-head">
          <h3 className="hd-title" id={titleId}>{title}</h3>
          {subtitle && <p className="hd-sub">{subtitle}</p>}
        </div>
        {children && <div className="hd-body">{children}</div>}
        {footer && <div className="hd-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'red' for destructive (default), 'cyan' for neutral confirmations. */
  tone?: HudDialogTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'red',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <HudDialog
      open={open}
      onClose={onCancel}
      title={title}
      tone={tone}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="hd-btn hd-btn--ghost" onClick={onCancel} disabled={busy} data-autofocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`hd-btn ${tone === 'red' ? 'hd-btn--danger' : 'hd-btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <div className="hd-message">{message}</div>}
    </HudDialog>
  );
}
