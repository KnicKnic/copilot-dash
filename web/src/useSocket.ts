import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { io, Socket } from "socket.io-client";
import type { RunDetails, WatchEvent } from "./types";

const SOCKET_URL =
  import.meta.env.MODE === "development" ? "http://localhost:3456" : "";

// ── Shared module-level state ──
// Keeps runs in sync across all components using useSocket(),
// so navigating between pages doesn't lose data.

let sharedSocket: Socket | null = null;
let refCount = 0;
let sharedRuns: RunDetails[] = [];
let sharedConnected = false;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getRunsSnapshot() {
  return sharedRuns;
}

function getConnectedSnapshot() {
  return sharedConnected;
}

function getSocket(): Socket {
  if (!sharedSocket) {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      sharedConnected = true;
      emitChange();
    });

    socket.on("disconnect", () => {
      sharedConnected = false;
      emitChange();
    });

    socket.on("runs:initial", (initialRuns: RunDetails[]) => {
      sharedRuns = initialRuns;
      emitChange();
    });

    socket.on("run:event", (event: WatchEvent) => {
      if (event.type === "removed") {
        sharedRuns = sharedRuns.filter((r) => r.id !== event.run.id);
      } else {
        const idx = sharedRuns.findIndex((r) => r.id === event.run.id);
        if (idx >= 0) {
          sharedRuns = [...sharedRuns];
          sharedRuns[idx] = event.run;
        } else {
          sharedRuns = [event.run, ...sharedRuns];
        }
      }
      emitChange();
    });

    socket.on("runs:refreshed", (allRuns: RunDetails[]) => {
      sharedRuns = allRuns;
      emitChange();
    });

    sharedSocket = socket;
  }
  refCount++;
  return sharedSocket;
}

function releaseSocket() {
  refCount--;
  if (refCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    sharedRuns = [];
    sharedConnected = false;
    refCount = 0;
  }
}

/**
 * Hook to subscribe to real-time run events via Socket.IO.
 * State is shared at the module level so navigating between
 * pages doesn't lose the runs data.
 */
export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    return () => {
      releaseSocket();
    };
  }, []);

  const connected = useSyncExternalStore(subscribe, getConnectedSnapshot);
  const runs = useSyncExternalStore(subscribe, getRunsSnapshot);

  const onEvent = useCallback(
    (handler: (event: WatchEvent) => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on("run:event", handler);
      return () => {
        socket.off("run:event", handler);
      };
    },
    []
  );

  return { connected, runs, onEvent };
}
