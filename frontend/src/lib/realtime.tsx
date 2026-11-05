'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type RealtimeEvent = { type: string; [key: string]: unknown };
type Listener = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  connected: boolean;
  send: (type: string, payload?: object) => boolean;
  subscribe: (listener: Listener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/** Même origine que la page : le rewrite Next.js /api/v1/* relaie la connexion vers l'API. */
function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/ws`;
}

/**
 * Canal temps réel de la personne connectée : nouveaux messages, accusés de lecture et appels.
 * Reconnexion automatique (attente progressive) ; les requêtes concernées sont rafraîchies
 * dès qu'un événement arrive, le polling restant un filet de sécurité.
 */
export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const qc = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      const ws = new WebSocket(socketUrl());
      socketRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(String(e.data)) as RealtimeEvent;
        } catch {
          return;
        }
        if (event.type === 'message:new' || event.type === 'message:read') {
          const id = String(event.mentorshipId);
          void qc.invalidateQueries({ queryKey: ['mentorships', id, 'messages'] });
          void qc.invalidateQueries({ queryKey: ['mentorships', 'me'] });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
        } else if (event.type === 'group:workshop') {
          void qc.invalidateQueries({ queryKey: ['workshops'] });
        } else if (event.type === 'group:message') {
          void qc.invalidateQueries({ queryKey: ['groups', String(event.groupId), 'messages'] });
          void qc.invalidateQueries({ queryKey: ['groups', 'me'] });
          void qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
        for (const listener of listeners.current) listener(event);
      };
      ws.onclose = (e) => {
        setConnected(false);
        socketRef.current = null;
        // 4001 : session révoquée (déconnexion) ; inutile de se reconnecter.
        if (stopped || e.code === 4001) return;
        const delay = Math.min(30_000, 1_000 * 2 ** attempt) + Math.random() * 500;
        attempt += 1;
        retry = setTimeout(open, delay);
      };
    };
    open();

    return () => {
      stopped = true;
      clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, qc]);

  const send = useCallback((type: string, payload: object = {}) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type, ...payload }));
    return true;
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ connected, send, subscribe }), [connected, send, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime doit être utilisé dans RealtimeProvider');
  return ctx;
}
