const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.host;

let ws = null;
let isMatched = false; // 현재 매칭 상태 확인용

// 나를 식별하기 위한 고유 ID 생성 (페이지 접속 시 1회)
const userId = Math.random().toString(36).substring(2, 11);
const nicknameInput = document.querySelector(".nickname-input");
const textInput = document.querySelector(".text-input");
const sendButton = document.querySelector(".send-button"); // 전송/재연결 버튼
const chatUl = document.querySelector(".chat-ul");
//로딩이미지 관리
const userStatus = document.querySelector(".user-status");
let loadingImg = null;
// 버튼 상태를 변경하는 함수
function setButtonMode(mode) {
  if (mode === "connect") {
    isMatched = false;
    sendButton.textContent = "재연결";
    sendButton.style.backgroundColor = "#ff4757"; // 눈에 띄는 색상으로 변경 (선택사항)
    textInput.disabled = true; // 대화 전엔 입력창 막기
    textInput.placeholder = "매칭을 시작해 주세요.";
  } else {
    isMatched = true;
    sendButton.textContent = "전송";
    sendButton.style.backgroundColor = ""; // 원래 색상으로
    textInput.disabled = false;
    textInput.placeholder = "메시지를 입력하세요...";
    textInput.focus();
  }
}

function addSystemMsg(msg) {
  const li = document.createElement("li");
  li.style.textAlign = "center";
  li.style.color = "gray";
  li.style.margin = "10px 0";
  li.textContent = `[시스템] ${msg}`;
  chatUl.appendChild(li);
  chatUl.scrollTo(0, chatUl.scrollHeight);
}

function addLoadingImg() {
  if (loadingImg) return;
  loadingImg = document.createElement("img");
  loadingImg.src = "loding.gif";
  loadingImg.style.marginLeft = "5px";
  loadingImg.style.display = "inline";
  loadingImg.style.width = "2vw";  // 너비
  loadingImg.style.height = "auto"; // 높이 (선택 사항, 비율 맞추려면 auto)
  userStatus.appendChild(loadingImg);
}
function hiddenLoadingImg() {
  if (loadingImg) {
    loadingImg.style.display = "none";
    connectTag = document.createElement("p");
    connectTag.textContent = "🌐";
    userStatus.appendChild(connectTag);
  }
}
// 1단계: 대기실 연결
function initMatching() {
  setButtonMode("chat"); // 일단 버튼은 '전송' 상태 (상대 찾는 중 메시지용)
  sendButton.disabled = true; // 매칭 중엔 클릭 방지

  ws = new WebSocket(`${protocol}://${host}/lobby-ws`);

  ws.onopen = () => {
    ws.send("find_match");
    addSystemMsg("상대방을 찾는 중...");
    addLoadingImg()
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "matched") {
      ws.close();
      connectToChat(data.roomId);
    }
  };
}

// 2단계: 실제 채팅방 연결
function connectToChat(roomId) {
  ws = new WebSocket(`${protocol}://${host}/chat-ws/${roomId}`);

  ws.onopen = () => {
    sendButton.disabled = false; // 매칭 완료 시 버튼 활성화
    setButtonMode("chat");
    addSystemMsg("상대방과 연결되었습니다!");
    hiddenLoadingImg();
  };

  ws.onmessage = (event) => {
    const receivedData = JSON.parse(event.data);

    if (receivedData.type === "disconnected") {
      addSystemMsg("상대방이 나갔습니다. 재연결 버튼을 눌러주세요.");
      ws.close();
      setButtonMode("connect"); // 버튼을 [재연결]로 변경
      return;
    }

    // 일반 메시지 출력
    const li = document.createElement("li");
    li.className = "chat-li";
    li.innerHTML = `<span class="chat-nickname">${receivedData.nickname == "익명" ?
      (receivedData.userId == userId ? receivedData.nickname : "낯선이") :
      receivedData.nickname} : </span>
      <span class="chat-text">${receivedData.text}</span>
      <span style="font-size:10px; color:#888;"> (${receivedData.time})</span>`;
    chatUl.appendChild(li);
    chatUl.scrollTo(0, chatUl.scrollHeight);
  };
}

// 버튼 클릭 이벤트 통합 처리
const handleButtonClick = (e) => {
  if (e) e.preventDefault();

  if (!isMatched) {
    // [재연결] 모드일 때 클릭 시
    chatUl.innerHTML = ""; // 채팅 내역 비우기
    initMatching();
  } else {
    // [전송] 모드일 때 클릭 시
    if (!textInput.value.trim() || ws.readyState !== WebSocket.OPEN) return;

    const chat = {
      userId: userId,
      nickname: nicknameInput.value || "익명",
      text: textInput.value,
    };

    ws.send(JSON.stringify(chat));
    textInput.value = "";
    textInput.focus();
  }
};

sendButton.addEventListener("click", handleButtonClick);

textInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && isMatched) handleButtonClick(e);
});

// 페이지 접속 시 최초 1회 매칭 시작
initMatching();
