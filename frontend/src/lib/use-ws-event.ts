"use client";

import { useEffect } from "react";
import { wsClient, type WSEvent } from "./websocket";

/**
 * Subscribe to a specific WebSocket event type.
 * Automatically subscribes/unsubscribes on mount/unmount.
 *
 * Usage:
 *   useWSEvent<TranscodeProgressData>("transcode.progress", (event) => {
 *     console.log(event.data.progress);
 *   });
 */
export function useWSEvent<T = unknown>(
  type: string,
  handler: (event: WSEvent<T>) => void,
): void {
  useEffect(() => {
    return wsClient.on<T>(type, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
}
