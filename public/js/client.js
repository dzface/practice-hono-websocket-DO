// 현재 접속 환경에 맞춰 WebSocket 프로토콜 및 호스트 자동 설정
const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.host;
const ws = new WebSocket(`${protocol}://${host}/chat-ws`);

const nicknameInput = document.querySelector(".nickname-input");
const textInput = document.querySelector(".text-input");
const sendButton = document.querySelector(".send-button");
const chatUl = document.querySelector(".chat-ul");
const userNumber = document.querySelector(".user-number");
const chatForm = document.querySelector("form");

// 서버로부터 메시지 수신
ws.onmessage = (event) => {
  const receivedData = JSON.parse(event.data);
  
  // 접속자 수 업데이트
  if (receivedData.nickname === "userNumber") {
    if (userNumber) userNumber.textContent = `접속자 : ${receivedData.text} 명`;
    return;
  }

  // 채팅 메시지 추가
  const li = document.createElement("li");
  li.className = "chat-li";
  
  const nicknameSpan = document.createElement("span");
  nicknameSpan.className = "chat-nickname";
  nicknameSpan.textContent = `${receivedData.nickname} : `;
  
  const textSpan = document.createElement("span");
  textSpan.className = "chat-text";
  textSpan.textContent = receivedData.text;

  const timeSpan = document.createElement("span");
  timeSpan.style.fontSize = "10px";
  timeSpan.style.color = "#888";
  timeSpan.textContent = ` (${receivedData.time})`;

  li.appendChild(nicknameSpan);
  li.appendChild(textSpan);
  li.appendChild(timeSpan);
  chatUl.appendChild(li);

  // 스크롤 하단 이동
  chatUl.scrollTo(0, chatUl.scrollHeight);
};

// 메시지 전송 함수
const sendMessage = (e) => {
  if (e) e.preventDefault();
  if (!textInput.value.trim()) return;

  const chat = {
    nickname: nicknameInput.value ? nicknameInput.value : "익명",
    text: textInput.value
  };

  ws.send(JSON.stringify(chat));
  textInput.value = "";
  textInput.focus();
};

sendButton.addEventListener("click", sendMessage);

textInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage(e);
});

ws.onopen = () => console.log("Connected to Durable Object Server");
ws.onclose = () => console.log("Connection closed");