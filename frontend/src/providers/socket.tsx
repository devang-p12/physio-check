import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo
} from "react";

import { io, Socket } from "socket.io-client";

/* ---------------- TYPES ---------------- */

type SocketContextType = Socket | null;

interface SocketProviderProps {
  children: ReactNode;
}

/* ---------------- CONTEXT ---------------- */

const SocketContext = createContext<SocketContextType>(null);

/* ---------------- PROVIDER ---------------- */

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {

  const socket = useMemo(() => {

    return io("http://localhost:5000", {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );

};

/* ---------------- HOOK ---------------- */

export const useSocket = (): Socket => {

  const socket = useContext(SocketContext);

  if (!socket) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return socket;

};