// Sending a message to a running person: the same steps for a message sent at once and for one that waited in the queue.
import { invoke } from "@tauri-apps/api/core";
import type { Queued } from "./sessions";

export async function sendToSession(dispatch: (a: unknown) => void, sessionId: string, text: string, images: Queued["images"]): Promise<void> {
  dispatch({ type: "user-sent", sessionId, text, images: images.map((i) => i.url) });
  try {
    await invoke("send_message", { sessionId, text, images: images.map((i) => ({ media_type: i.mediaType, data: i.data })) });
  } catch (e) {
    dispatch({ type: "event", sessionId, record: { type: "kona/stderr", text: `Could not send the message: ${String(e)}` } });
  }
}

/** Stop the turn that is running; the conversation stays open. */
export const interruptSession = (sessionId: string) => invoke("interrupt_session", { sessionId }).catch(() => {});
