import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken, refreshSession } from './api';
import { useAuth } from './auth';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  online: Set<string>;
}
const Ctx = createContext<SocketState>({ socket: null, connected: false, online: new Set() });

/**
 * One authenticated Socket.IO connection per signed-in tab. The token is read at every
 * (re)connect, so it survives access-token rotation.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const s = io({ auth: (cb) => cb({ token: getAccessToken() }), transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('ready', (p: { onlineUserIds: string[] }) => setOnline(new Set(p.onlineUserIds)));
    s.on('presence', (p: { userId: string; online: boolean }) =>
      setOnline((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      }),
    );
    s.on('auth_error', async () => {
      if (await refreshSession()) s.connect();
    });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id]);

  return <Ctx.Provider value={{ socket, connected, online }}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);

/** Subscribe to a server event for the lifetime of the component. */
export function useSocketEvent<T = any>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (p: T) => ref.current(p);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
