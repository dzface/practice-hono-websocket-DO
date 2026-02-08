import { Hono } from 'hono'

// --- 1. 대기실 (Lobby) DO: 유저들을 짝지어줌 ---
export class Lobby {
  state: DurableObjectState
  waitingSocket: WebSocket | null = null

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()

    server.addEventListener('message', (msg) => {
      if (msg.data === 'find_match') {
        this.handleMatch(server)
      }
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  handleMatch(ws: WebSocket) {
    if (this.waitingSocket && this.waitingSocket !== ws) {
      // 짝이 맞음! 새로운 방 ID 생성
      const roomId = crypto.randomUUID()
      const matchData = JSON.stringify({ type: 'matched', roomId })
      
      this.waitingSocket.send(matchData)
      ws.send(matchData)
      
      this.waitingSocket = null // 대기실 비우기
    } else {
      // 첫 번째 대기자 등록
      this.waitingSocket = ws
      ws.send(JSON.stringify({ type: 'waiting', message: '상대방을 찾는 중...' }))
    }
  }
}

// --- 2. 실제 채팅방 (ChatRoom) DO: 1:1 대화 ---
export class ChatRoom {
  state: DurableObjectState
  sessions: Set<WebSocket> = new Set()

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair())
    server.accept()
    this.sessions.add(server)

    server.addEventListener('message', (msg) => {
      const data = JSON.parse(msg.data as string)
      const response = JSON.stringify({
        ...data,
        time: new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: 'numeric', hour12: true })
      })
      
      // 방에 있는 상대방에게만 전송
      for (const s of this.sessions) {
        s.send(response)
      }
    })

    server.addEventListener('close', () => {
      this.sessions.delete(server)
      // 상대방에게 종료 알림
      for (const s of this.sessions) {
        s.send(JSON.stringify({ type: 'disconnected', message: '상대방이 나갔습니다.' }))
      }
    })

    return new Response(null, { status: 101, webSocket: client })
  }
}

// --- 3. Hono 설정 ---
type Bindings = {
  ASSETS: Fetcher
  LOBBY: DurableObjectNamespace
  CHAT_ROOM: DurableObjectNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

// 정적 파일 서빙
app.get('/', (c) => c.env.ASSETS.fetch(new Request(new URL('/main.html', c.req.url))))
app.get('/chat', (c) => c.env.ASSETS.fetch(new Request(new URL('/chat.html', c.req.url))))
app.get('/js/*', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/*.css', (c) => c.env.ASSETS.fetch(c.req.raw))

// 로비 접속 (매칭 대기)
app.get('/lobby-ws', async (c) => {
  const id = c.env.LOBBY.idFromName('global-lobby')
  return c.env.LOBBY.get(id).fetch(c.req.raw)
})

// 실제 채팅방 접속
app.get('/chat-ws/:roomId', async (c) => {
  const id = c.env.CHAT_ROOM.idFromName(c.req.param('roomId'))
  return c.env.CHAT_ROOM.get(id).fetch(c.req.raw)
})

export default app