const WebSocket = require('ws')

let wss = null
const clients = new Set()

function attachWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/stream' })

  wss.on('connection', (ws) => {
    clients.add(ws)
    console.log('[ws] client connected (total:', clients.size, ')')

    const playerService = server._playerService
    const plannerService = server._plannerService

    if (playerService) {
      send(ws, { type: 'state', ...playerService.getBroadcastState() })
    }
    if (plannerService) {
      send(ws, { type: 'slot', slot: plannerService.getCurrentSlot() })
    }

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'ping') send(ws, { type: 'pong' })
      } catch { }
    })

    ws.on('close', () => {
      clients.delete(ws)
      console.log('[ws] client disconnected (total:', clients.size, ')')
    })

    ws.on('error', () => clients.delete(ws))
  })

  console.log('[ws] server attached at /stream')
  return wss
}

function broadcast(data) {
  const msg = JSON.stringify(data)
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  }
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
}

function getClientCount() {
  return clients.size
}

module.exports = { attachWebSocket, broadcast, getClientCount }
