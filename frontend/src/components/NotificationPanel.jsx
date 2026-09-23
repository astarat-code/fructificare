// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
/**
 * NotificationPanel.jsx — In-app notification panel
 *
 * Lists the notifications, with the ability to:
 *   - mark one as read
 *   - mark everything as read
 *   - delete one
 *   - navigate to the related page
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, X, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';
import gamificationService from '../services/gamificationService';
import notificationService from '../services/notificationService';

// ── Helpers ────────────────────────────────────────────────────────────────────

function _relativeTime(isoDate, lang) {
  if (!isoDate) return '';
  const en = lang === 'en';
  const diff  = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return en ? 'just now' : "à l'instant";
  if (mins < 60)  return en ? `${mins} min ago` : `il y a ${mins} min`;
  if (hours < 24) return en ? `${hours} h ago` : `il y a ${hours} h`;
  return en ? `${days} d ago` : `il y a ${days} j`;
}

// ── NotificationBell ──────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open,        setOpen]        = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => notificationService.getUnreadCount());
  const [panelStyle,  setPanelStyle]  = useState({});
  const bellRef  = useRef(null);
  const panelRef = useRef(null);

  // Rafraîchissement sur événements gamification
  useEffect(() => {
    const refresh = () => setUnreadCount(notificationService.getUnreadCount());
    const u1 = gamificationService.onEvent('notificationAdded', refresh);
    const u2 = gamificationService.onEvent('notificationRead',  refresh);
    window.addEventListener('fructificare-data-changed', refresh);
    return () => { u1(); u2(); window.removeEventListener('fructificare-data-changed', refresh); };
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /** Calcule le positionnement `fixed` du panneau à partir du bouton cloche */
  const computePanelStyle = () => {
    if (!bellRef.current) return {};
    const rect       = bellRef.current.getBoundingClientRect();
    const PANEL_W    = Math.min(320, window.innerWidth - 16);
    const top        = rect.bottom + 8;
    // Aligner le bord droit du panneau sur celui du bouton, puis recadrer
    let left = rect.right - PANEL_W;
    if (left < 8)                             left = 8;
    if (left + PANEL_W > window.innerWidth - 8) left = window.innerWidth - PANEL_W - 8;
    return { position: 'fixed', top, left, width: PANEL_W, zIndex: 9999 };
  };

  const handleToggle = () => {
    if (!open) setPanelStyle(computePanelStyle());
    setOpen(v => !v);
  };

  const hasUnread = unreadCount > 0;

  return (
    <div ref={panelRef}>
      <button
        ref={bellRef}
        onClick={handleToggle}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent transition-colors"
        title={hasUnread ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
        aria-label="Notifications"
      >
        {hasUnread
          ? <BellRing className="w-4.5 h-4.5 text-primary animate-pulse" />
          : <Bell className="w-4.5 h-4.5 text-muted-foreground" />
        }
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel onClose={() => setOpen(false)} style={panelStyle} />
      )}
    </div>
  );
}

// ── NotificationPanel ─────────────────────────────────────────────────────────

export default function NotificationPanel({ onClose, style }) {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const L = (fr, en) => (lang === 'en' ? en : fr);
  const [items, setItems] = useState(() => notificationService.getAll());

  // Rafraîchir la liste localement
  const refresh = () => setItems(notificationService.getAll());

  useEffect(() => {
    const u1 = gamificationService.onEvent('notificationAdded', refresh);
    const u2 = gamificationService.onEvent('notificationRead',  refresh);
    return () => { u1(); u2(); };
  }, []);

  const handleMarkRead = (id) => {
    notificationService.markRead(id);
    refresh();
  };

  const handleMarkAllRead = () => {
    notificationService.markAllRead();
    refresh();
  };

  const handleDismiss = (id) => {
    notificationService.dismiss(id);
    refresh();
  };

  const handleNavigate = (notif) => {
    notificationService.markRead(notif.id);
    if (notif.action) navigate(notif.action);
    onClose?.();
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-xl overflow-hidden"
      style={style}
    >

      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Notifications
          {unreadCount > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold">
              {unreadCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={L('Tout marquer comme lu', 'Mark all as read')}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{L('Tout lire', 'Read all')}</span>
            </button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto max-h-80">
        {items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{L('Aucune notification', 'No notification')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(notif => (
              <li
                key={notif.id}
                className={`group relative px-4 py-3 transition-colors ${
                  notif.read
                    ? 'bg-transparent'
                    : 'bg-primary/5 hover:bg-primary/10'
                }`}
              >
                {/* Indicateur non-lu */}
                {!notif.read && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}

                <div
                  className={`pr-6 ${notif.action ? 'cursor-pointer' : ''}`}
                  onClick={() => notif.action && handleNavigate(notif)}
                >
                  <p className="text-xs font-semibold text-foreground leading-snug">
                    {lang === 'en' ? (notif.titleEn || notif.titleFr) : notif.titleFr}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {lang === 'en' ? (notif.messageEn || notif.messageFr) : notif.messageFr}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {_relativeTime(notif.createdAt, lang)}
                  </p>
                </div>

                {/* Actions au survol */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title={L('Marquer comme lu', 'Mark as read')}
                    >
                      <CheckCheck className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(notif.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title={L('Supprimer', 'Delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pied de panneau */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <button
            onClick={() => {
              notificationService.markAllRead();
              refresh();
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground w-full text-center transition-colors"
          >
            {lang === 'en' ? 'Clear all read notifications' : 'Effacer toutes les notifications lues'}
          </button>
        </div>
      )}
    </div>
  );
}
