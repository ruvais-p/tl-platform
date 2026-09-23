import type { SupportClientCommand, SupportConnectionState, SupportServerEvent, SupportTicket } from "./types";

type SocketLike = Pick<WebSocket, "readyState" | "send" | "close" | "onopen" | "onmessage" | "onclose" | "onerror">;
type SocketFactory = (url: string) => SocketLike;

export class SupportSocketClient {
  private socket: SocketLike | null = null;
  private stopped = true;
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private getTicket: () => Promise<SupportTicket>,
    private onEvent: (event: SupportServerEvent) => void,
    private onState: (state: SupportConnectionState) => void,
    private onRecover: () => void,
    private socketFactory: SocketFactory = (url) => new WebSocket(url),
  ) {}

  connect() {
    this.stopped = false;
    void this.open(false);
  }

  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, "Client closed");
    this.socket = null;
    this.onState("idle");
  }

  send(command: SupportClientCommand) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    this.socket.send(JSON.stringify(command));
    return true;
  }

  private async open(recovering: boolean) {
    if (this.stopped) return;
    this.onState(recovering ? "recovering" : "connecting");
    try {
      const ticket = await this.getTicket();
      if (this.stopped) return;
      const separator = ticket.websocket_url.includes("?") ? "&" : "?";
      const socket = this.socketFactory(`${ticket.websocket_url}${separator}ticket=${encodeURIComponent(ticket.ticket)}`);
      this.socket = socket;
      socket.onopen = () => {
        if (this.socket !== socket || this.stopped) return;
        const recovered = this.retries > 0;
        this.retries = 0;
        this.onState("live");
        if (recovered) this.onRecover();
      };
      socket.onmessage = (message) => {
        if (this.socket !== socket || this.stopped) return;
        try { this.onEvent(JSON.parse(String(message.data)) as SupportServerEvent); } catch {}
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.socket !== socket || this.stopped) return;
        this.socket = null;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.retries >= 6) {
      this.onState("offline");
      return;
    }
    this.retries += 1;
    this.onState("recovering");
    const delay = Math.min(8000, 400 * 2 ** (this.retries - 1)) + Math.floor(Math.random() * 200);
    this.reconnectTimer = setTimeout(() => void this.open(true), delay);
  }
}
