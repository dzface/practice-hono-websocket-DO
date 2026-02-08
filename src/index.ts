import { Hono } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { logger } from "hono/logger";
import type { WSContext } from "hono/ws"; // 타입 불러오기

// --- 1. Durable Object 클래스 정의 (실시간 통신 중앙 통제) ---
export class ChatRoom {
  state: DurableObjectState;
  sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // 웹소켓 연결 요청 처리
  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());

    // 서버 측 소켓 수락 및 세션 관리
    server.accept();
    this.sessions.add(server);

    // 메시지 수신 이벤트
    server.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data as string);

        // 서버에서 시간 정보를 추가하여 재조립
        const responseData = JSON.stringify({
          nickname: data.nickname || "익명",
          text: data.text || "",
          time: new Date().toLocaleTimeString("ko-KR", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
          }),
        });

        this.broadcast(responseData);
      } catch (e) {
        // 혹시 모를 에러 방지 (시스템 메시지 등)
        this.broadcast(msg.data);
      }
    });

    // 연결 종료 이벤트
    server.addEventListener("close", () => {
      this.sessions.delete(server);
      this.broadcastUserCount();
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
    });

    // 신규 접속 시 인원수 업데이트
    this.broadcastUserCount();

    return new Response(null, { status: 101, webSocket: client });
  }

  // 모든 세션에 메시지 전송 함수
  broadcast(message: any) {
    for (const session of this.sessions) {
      try {
        session.send(message);
      } catch (e) {
        this.sessions.delete(session);
      }
    }
  }

  // 접속자 수 알림 함수
  broadcastUserCount() {
    const data = JSON.stringify({
      nickname: "userNumber",
      text: `${this.sessions.size}`,
      time: new Date().toLocaleTimeString("ko-KR", {
        hour: "numeric",
        minute: "numeric",
      }),
    });
    this.broadcast(data);
  }
}

// --- 2. Hono 앱 설정 및 타입 정의 ---
type Bindings = {
  ASSETS: Fetcher;
  CHAT_ROOM: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", logger());
// 정적 파일 서빙 (HTML, JS, CSS)
app.get("/", (c) =>
  c.env.ASSETS.fetch(new Request(new URL("/main.html", c.req.url))),
);
app.get("/chat", (c) =>
  c.env.ASSETS.fetch(new Request(new URL("/chat.html", c.req.url))),
);
app.get("/js/*", (c) => c.env.ASSETS.fetch(c.req.raw));
app.get("/*.css", (c) => c.env.ASSETS.fetch(c.req.raw));
app.get("/*.gif", (c) => c.env.ASSETS.fetch(c.req.raw));

// WebSocket 연결 경로
app.get("/chat-ws", async (c) => {
  // 'global-room'이라는 고유 ID로 단일 Durable Object 인스턴스 생성/접속
  const id = c.env.CHAT_ROOM.idFromName("global-room");
  const obj = c.env.CHAT_ROOM.get(id);

  // Durable Object로 요청 전달
  return obj.fetch(c.req.raw);
});

export default app;
