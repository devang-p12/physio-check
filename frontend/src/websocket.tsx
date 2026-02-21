import { updateUI } from "./ui"

export function setupSocket(): WebSocket {
  const socket = new WebSocket("ws://localhost:3001")

  socket.onmessage = (event: MessageEvent) => {
    const { count } = JSON.parse(event.data)
    updateUI(count)
  }

  return socket
}
