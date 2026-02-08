import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'
import { logger } from 'hono/logger'
import type { WSContext } from 'hono/ws' // 타입 불러오기



// Cloudflare 환경 변수 타입 정의
type Bindings = {
  ASSETS: Fetcher
}
const app = new Hono<{ Bindings: Bindings }>()
// 전역에서 클라이언트를 관리 (WSContext 타입 적용)
const clients = new Set<WSContext>()

app.use('*', logger())

// 1. 메인 페이지 (public/main.html)
app.get('/', async (c) => {
  return c.env.ASSETS.fetch(new Request(new URL('/main.html', c.req.url)))
})
app.get('/chat', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = './chat.html'
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
})

// 3. 정적 자산 자동 서빙 (JS, CSS, Images 등)
// 별도의 라우트 설정 없이 public 폴더 내의 경로를 그대로 따릅니다.
app.get('/js/*', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/*.css', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/*.gif', (c) => c.env.ASSETS.fetch(c.req.raw))

// 2. WebSocket 핸들러
app.get(
  '/chat-ws',
  upgradeWebSocket((c) => {
    return {
      onOpen(event, ws) {
        console.log('연결됨')
        clients.add(ws)
        
        const systemMsg = JSON.stringify({
          nickname: 'System',
          text: '웹소켓 통신이 연결되었습니다.',
          time: new Date().toLocaleTimeString()
        })
        ws.send(systemMsg)
        broadcastUserCount()
      },
      onMessage(event, ws) {
        // event.data는 string | ArrayBuffer 타입입니다.
        const message = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)
        
        clients.forEach((client) => {
          // readyState 체크 없이 Hono의 ws 객체를 통해 안전하게 전송 가능
          client.send(message)
        })
      },
      onClose(event, ws) {
        console.log('연결 종료')
        clients.delete(ws)
        broadcastUserCount()
      },
      onError(event, ws) {
        console.error('에러 발생')
        clients.delete(ws)
      }
    }
  })
)

function broadcastUserCount() {
  const countData = JSON.stringify({
    nickname: "userNumber",
    text: `${clients.size}`,
    time: new Date().toLocaleTimeString()
  });
  clients.forEach((client) => {
    client.send(countData)
  })
}

export default app