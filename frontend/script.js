// Local network / Laptop IP auto-detect
const activeTypers = new Set();
const BACKEND_HOST = window.location.hostname || "127.0.0.1";
const BACKEND_HTTP = `http://${BACKEND_HOST}:8000`;
const BACKEND_WS = `ws://${BACKEND_HOST}:8000`;

const myClientId = "id_" + Math.random().toString(36).substr(2, 9);

let socket = null;
let currentUsername = "";
let currentRoomId = "";
let typingTimeout = null;

const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const messagesContainer = document.getElementById("messages-container");
const msgInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");

// 1. URL me room hone par auto-fill & prompt for direct join
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get("room");

  if (roomParam) {
    const roomInput = document.getElementById("room-input");
    const nameInput = document.getElementById("username-input");

    if (roomInput) {
      roomInput.value = roomParam;
    }

    if (nameInput) {
      nameInput.focus();
      nameInput.placeholder = "Enter your name & hit Enter";
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          joinRoom();
        }
      });
    }
  }
});

// 2. Random Room ID Generator
function generateSecureRoomId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  document.getElementById("room-input").value = `${part1}-${part2}-${part3}`;
}

// 3. Room Join Process
async function joinRoom() {
  const username = document.getElementById("username-input").value.trim();
  const roomId = document.getElementById("room-input").value.trim();

  if (!username || !roomId) {
    alert("Please enter Name and Room ID!");
    return;
  }

  currentUsername = username;
  currentRoomId = roomId;

  // Invite Link Header Setup (Mobile HTTP + Desktop Support)
  const roomHeader = document.getElementById("current-room");
  roomHeader.innerText = `Room: ${roomId} (Click to copy link)`;
  roomHeader.style.cursor = "pointer";
  roomHeader.title = "Click to Copy Invite Link";
  
  roomHeader.onclick = async () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(currentRoomId)}`;

    // Modern clipboard (Works on HTTPS / Localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        alert("Invite link copied to clipboard!\n" + inviteUrl);
        return;
      } catch (err) {
        // Fallback par aage badho
      }
    }

    // Mobile HTTP fallback (Works on every phone)
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = inviteUrl;
    tempTextArea.style.position = "fixed";
    tempTextArea.style.left = "-9999px";
    tempTextArea.style.top = "0";
    document.body.appendChild(tempTextArea);
    tempTextArea.focus();
    tempTextArea.select();

    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(tempTextArea);
      if (successful) {
        alert("Invite link copied to clipboard!\n" + inviteUrl);
      } else {
        prompt("Copy this invite link manually:", inviteUrl);
      }
    } catch (err) {
      document.body.removeChild(tempTextArea);
      prompt("Copy this invite link manually:", inviteUrl);
    }
  };

  document.getElementById("current-user").innerText = `Logged in as: ${username}`;

  // UI switch
  messagesContainer.innerHTML = "";
  joinScreen.style.display = "none";
  chatScreen.style.display = "flex";

  connectWebSocket(roomId, username);
}

// 4. WebSocket Connection
function connectWebSocket(roomId, username) {
  socket = new WebSocket(`${BACKEND_WS}/ws/${roomId}/${username}`);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data); // <-- Yeh line zaroori hai!

    // 1. Name Assigned
    if (data.type === "NAME_ASSIGNED") {
      currentUsername = data.username;
      document.getElementById("current-user").innerText = `Logged in as: ${currentUsername}`;
      if (data.is_changed) {
        alert(`Name already taken! Assigned: ${currentUsername}`);
      }
      return;
    }

    // 2. Multi-user Typing Event
    if (data.type === "typing") {
      if (data.senderId !== myClientId) {
        if (data.is_typing) {
          activeTypers.add(data.user);
        } else {
          activeTypers.delete(data.user);
        }

        const typersArray = Array.from(activeTypers);
        if (typersArray.length === 0) {
          typingIndicator.innerText = "";
        } else if (typersArray.length === 1) {
          typingIndicator.innerText = `${typersArray[0]} is typing...`;
        } else if (typersArray.length === 2) {
          typingIndicator.innerText = `${typersArray[0]} and ${typersArray[1]} are typing...`;
        } else {
          typingIndicator.innerText = `${typersArray[0]} and ${typersArray.length - 1} others are typing...`;
        }
      }
      return;
    }
    

    // 3. Normal Message
    displayMessage(data.user, data.text, data.senderId);
  };
}

// 5. Message Display
function displayMessage(user, text, senderId) {
  const div = document.createElement("div");

  if (user === "System") {
    div.className = "msg msg-system";
    div.innerText = text;
  } else if (senderId === myClientId || user === currentUsername) {
    div.className = "msg msg-me";
    div.innerText = text;
  } else {
    div.className = "msg msg-other";
    div.innerHTML = `<span class="sender-name">${user}</span>${text}`;
  }

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 6. Typing Event Sender
msgInput.addEventListener("input", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "typing",
      is_typing: true,
      senderId: myClientId
    }));

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.send(JSON.stringify({
        type: "typing",
        is_typing: false,
        senderId: myClientId
      }));
    }, 1500);
  }
});

// 7. Message Send Action
function sendMessage() {
  const text = msgInput.value.trim();
  if (text && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "typing", is_typing: false, senderId: myClientId }));

    socket.send(JSON.stringify({
      type: "message",
      text: text,
      senderId: myClientId
    }));

    msgInput.value = "";
  }
}

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// 8. Mobile Keyboard Auto-Scroll Fix
msgInput.addEventListener("focus", () => {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 300);
});

// 9. Leave Room
function leaveRoom() {
  if (socket) socket.close();
  activeTypers.clear(); // Typers reset
  messagesContainer.innerHTML = "";
  typingIndicator.innerText = "";
  chatScreen.style.display = "none";
  joinScreen.style.display = "block";
}