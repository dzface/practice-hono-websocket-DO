/**
 * WebSocket 주소 설정
 * Cloudflare Workers 배포 환경에 맞춰 현재 호스트 주소를 자동으로 인식합니다.
 */
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.host;
// Hono 서버에서 설정한 WebSocket 엔드포인트 경로 (/chat-ws)
const ws = new WebSocket(`${protocol}://${host}/chat-ws`);

// DOM 요소 선택
const nicknameInput = document.querySelector(".nickname-input");
const textInput = document.querySelector(".text-input");
const sendButton = document.querySelector(".send-button");
const chatUl = document.querySelector(".chat-ul");
const userNumber = document.querySelector(".user-number");
const chatForm = document.querySelector("#chat-form") || document.querySelector("form");

// 1. 서버로부터 메시지 수신
ws.onmessage = (event) => {
  try {
    const receivedData = JSON.parse(event.data);
    
    // 접속자 수 업데이트 처리
    if (receivedData.nickname === "userNumber") {
      if (userNumber) {
        userNumber.textContent = `접속자 : ${receivedData.text} 명`;
      }
      return;
    }

    // 일반 채팅 메시지 렌더링
    const li = document.createElement("li");
    const chatNickname = document.createElement("span");
    const chatText = document.createElement("span");
    const chatTime = document.createElement("span");

    li.className = "chat-li";
    chatNickname.className = "chat-nickname";
    chatText.className = "chat-text"; // 기존 오타 수정 (chat-nickname -> chat-text)
    chatTime.className = "chat-time";

    chatNickname.textContent = `${receivedData.nickname} : `;
    chatText.textContent = receivedData.text;
    chatTime.textContent = ` (${receivedData.time})`;
    chatTime.style.fontSize = "12px";
    chatTime.style.color = "#888";

    li.appendChild(chatNickname);
    li.appendChild(chatText);
    li.appendChild(chatTime);
    chatUl.appendChild(li);

    // 새 메시지 수신 시 스크롤 하단 이동
    chatUl.scrollTo(0, chatUl.scrollHeight);
  } catch (error) {
    console.error("데이터 파싱 에러:", error);
  }
};

// 2. 메시지 전송 로직
const sendMessage = () => {
  if (!textInput || !textInput.value.trim()) return;

  const chat = {
    nickname: nicknameInput.value ? nicknameInput.value : "익명",
    text: textInput.value
  };

  ws.send(JSON.stringify(chat));
  
  // 입력창 초기화
  textInput.value = "";
  textInput.focus();
};

// 3. 이벤트 리스너 설정
if (sendButton) {
  sendButton.addEventListener("click", (event) => {
    event.preventDefault();
    sendMessage();
  });
}

// Enter 키 전송 지원
if (textInput) {
  textInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

// 4. 연결 상태 관리
ws.onopen = () => {
  console.log("서버와 연결되었습니다.");
};

ws.onclose = () => {
  const newMessage = document.createElement("li");
  newMessage.textContent = "⚠️ 연결이 종료되었습니다. (WebSocket closed)";
  newMessage.style.color = "red";
  chatUl.appendChild(newMessage);
};

ws.onerror = (error) => {
  console.error("WebSocket 에러 발생:", error);
};