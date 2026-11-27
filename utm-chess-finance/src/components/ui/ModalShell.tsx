'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Module-level Escape stack so pressing Escape only dismisses the topmost modal.
interface EscapeEntry {
  id: string;
  onEscape: () => void;
}
const escapeStack: EscapeEntry[] = [];
let keyListenerAttached = false;

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || escapeStack.length === 0) return;
  const top = escapeStack[escapeStack.length - 1];
  if (top) {
    e.stopPropagation();
    top.onEscape();
  }
}

function registerEscape(id: string, onEscape: () => void) {
  const existingIdx = escapeStack.findIndex((item) => item.id === id);
  if (existingIdx >= 0) escapeStack.splice(existingIdx, 1);
  escapeStack.push({ id, onEscape });
  if (!keyListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeyDown);
    keyListenerAttached = true;
  }
}

function unregisterEscape(id: string) {
  const idx = escapeStack.findIndex((item) => item.id === id);
  if (idx >= 0) escapeStack.splice(idx, 1);
  if (escapeStack.length === 0 && keyListenerAttached && typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeyDown);
    keyListenerAttached = false;
  }
}

// Reference-counted body scroll lock across stacked modals.
let openLockCount = 0;
let savedBodyOverflow = '';
let savedBodyPaddingRight = '';
let savedHtmlOverflow = '';

function acquireScrollLock() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (openLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    savedHtmlOverflow = document.documentElement.style.overflow;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (gap > 0) {
      document.body.style.paddingRight = `${gap}px`;
    }
  }
  openLockCount += 1;
}

function releaseScrollLock() {
  if (typeof document === 'undefined') return;
  openLockCount = Math.max(0, openLockCount - 1);
  if (openLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
    document.documentElement.style.overflow = savedHtmlOverflow;
  }
}

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Unified z-index layer token: z-50 primary, z-[60] review/history, z-[70] drawers/studio, z-[90] confirm/lightbox */
  zIndexClass?: string;
  /** Container layout: centered card, responsive bottom sheet on mobile, or fullscreen workspace */
  align?: 'center' | 'sheet' | 'full';
  /** Max width utility applied cleanly when align !== 'full' */
  maxWidthClass?: string;
  backdropClassName?: string;
  wrapperClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
}

export default function ModalShell({
  open,
  onClose,
  children,
  zIndexClass = 'z-50',
  align = 'center',
  maxWidthClass = 'max-w-lg',
  backdropClassName = 'bg-slate-950/65 backdrop-blur-xs',
  wrapperClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
}: ModalShellProps) {
  const [mounted, setMounted] = useState(false);
  const instanceId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    acquireScrollLock();
    if (closeOnEscape) {
      registerEscape(instanceId, () => onCloseRef.current());
    }
    return () => {
      if (closeOnEscape) unregisterEscape(instanceId);
      releaseScrollLock();
    };
  }, [open, closeOnEscape, instanceId]);

  if (!open || !mounted || typeof document === 'undefined') return null;

  if (align === 'full') {
    return createPortal(
      <div
        className={`fixed inset-0 ${zIndexClass} flex flex-col animate-[modalFadeIn_150ms_ease-out] ${wrapperClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>,
      document.body
    );
  }

  const alignClasses =
    align === 'sheet'
      ? 'items-end sm:items-center justify-center p-0 sm:p-4'
      : 'items-center justify-center p-3 sm:p-4';

  const panelMotion =
    align === 'sheet'
      ? 'animate-[modalSheetUp_180ms_ease-out] sm:animate-[modalScaleIn_160ms_ease-out]'
      : 'animate-[modalScaleIn_160ms_ease-out]';

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto overscroll-contain`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={`fixed inset-0 ${backdropClassName} animate-[modalFadeIn_150ms_ease-out]`}
        aria-hidden="true"
        onClick={() => {
          if (closeOnBackdrop) onCloseRef.current();
        }}
      />
      <div
        className={`relative min-h-full flex ${alignClasses} ${wrapperClassName}`}
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) {
            onCloseRef.current();
          }
        }}
      >
        <div
          className={`relative w-full ${maxWidthClass} ${panelMotion}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
