import { afterEach, describe, expect, it, vi } from "vitest";

import { SupportSocketClient } from "./socket-client";
import type { SupportClientCommand, SupportConnectionState } from "./types";

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(new Event("open")); }
  drop() { this.readyState = 3; this.onclose?.(new CloseEvent("close")); }
}

afterEach(() => vi.useRealTimers());

describe("SupportSocketClient", () => {
  it("gets a ticket, reports live state, and sends only over an open socket", async () => {
    const states: SupportConnectionState[] = [];
    const socket = new FakeSocket();
    const client = new SupportSocketClient(
      vi.fn(async () => ({ ticket: "secret value", expires_at: "", websocket_url: "ws://test/ws/course-support/" })),
      vi.fn(),
      (state) => states.push(state),
      vi.fn(),
      (url) => { expect(url).toContain("ticket=secret%20value"); return socket; },
    );
    const command: SupportClientCommand = {
      v: 1,
      type: "conversation.read",
      request_id: "request-1",
      conversation_id: "conversation-1",
      sequence: 1,
    };

    client.connect();
    await Promise.resolve();
    expect(client.send(command)).toBe(false);
    socket.open();
    expect(client.send(command)).toBe(true);
    expect(JSON.parse(socket.sent[0])).toEqual(command);
    expect(states).toEqual(["connecting", "live"]);
    client.disconnect();
  });

  it("obtains a fresh ticket and recovers after a bounded reconnect", async () => {
    vi.useFakeTimers();
    const tickets = vi.fn(async () => ({ ticket: "new", expires_at: "", websocket_url: "ws://test/ws" }));
    const sockets: FakeSocket[] = [];
    const recovered = vi.fn();
    const client = new SupportSocketClient(tickets, vi.fn(), vi.fn(), recovered, () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });

    client.connect();
    await Promise.resolve();
    sockets[0].open();
    sockets[0].drop();
    await vi.runAllTimersAsync();
    expect(tickets).toHaveBeenCalledTimes(2);
    sockets[1].open();
    expect(recovered).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("does not open a socket when disconnected during ticket acquisition", async () => {
    let resolveTicket: ((ticket: { ticket: string; expires_at: string; websocket_url: string }) => void) | undefined;
    const socketFactory = vi.fn(() => new FakeSocket());
    const client = new SupportSocketClient(
      () => new Promise((resolve) => { resolveTicket = resolve; }),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      socketFactory,
    );
    client.connect();
    client.disconnect();
    resolveTicket?.({ ticket: "unused", expires_at: "", websocket_url: "ws://test/ws" });
    await Promise.resolve();
    expect(socketFactory).not.toHaveBeenCalled();
  });
});
