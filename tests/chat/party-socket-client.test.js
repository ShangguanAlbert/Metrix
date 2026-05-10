import test from "node:test";
import assert from "node:assert/strict";

import { createPartySocketClient } from "../../src/pages/party/partySocket.js";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close(code, reason) {
    this.closeArgs = { code, reason };
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(payload) {
    this.onmessage?.({
      data: JSON.stringify(payload),
    });
  }
}

test("createPartySocketClient does not resend join_room for an already desired room", () => {
  const previousWebSocket = globalThis.WebSocket;
  const previousWindow = globalThis.window;
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket;
  globalThis.window = globalThis;
  globalThis.window.location = {
    protocol: "http:",
    host: "localhost:5173",
  };

  try {
    const client = createPartySocketClient({
      token: "test-token",
    });

    client.connect();
    const socket = FakeWebSocket.instances[0];
    assert.ok(socket, "expected a websocket instance to be created");

    socket.open();
    socket.receive({
      type: "authed",
    });

    client.joinRoom("room-1");
    client.joinRoom("room-1");

    const joinMessages = socket.sent.filter((message) => message.type === "join_room");
    assert.equal(joinMessages.length, 1);
    assert.deepEqual(joinMessages[0], {
      type: "join_room",
      roomId: "room-1",
    });
  } finally {
    globalThis.WebSocket = previousWebSocket;
    globalThis.window = previousWindow;
  }
});
