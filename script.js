// ==========================================
// 1. FIREBASE CONFIG - YOUR REAL CREDENTIALS
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA7QpK5B4Hn4tqK7zK7zK7zK7zK7zK7zK7z",
  authDomain: "robot-chat-458e2.firebaseapp.com",
  databaseURL: "https://robot-chat-458e2-default-rtdb.firebaseio.com",
  projectId: "robot-chat-458e2",
  storageBucket: "robot-chat-458e2.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// ==========================================
// 2. PASSWORD - CHANGE THIS
// ==========================================
const ROOM_PASSWORD = "08142652094.";

// ==========================================
// 3. INIT FIREBASE
// ==========================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const messagesRef = database.ref('messages');

// ==========================================
// 4. APP STATE VARIABLES
// ==========================================
let currentUserId = "";
let currentUserName = "";
let hasInit = false;

// ==========================================
// 5. DOM ELEMENTS
// ==========================================
const loginScreen = document.getElementById('login-screen');
const mainChatScreen = document.getElementById('main-chat-screen');
const loginForm = document.getElementById('login-form');
const nameInput = document.getElementById('name-input');
const messageBox = document.getElementById('message-box');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const callBtn = document.getElementById('call-btn');
const callOverlay = document.getElementById('call-overlay');
const endCallBtn = document.getElementById('end-call-btn');
const callStatus = document.getElementById('call-status');

// ==========================================
// 6. ADD PASSWORD FIELD TO LOGIN
// ==========================================
const passwordInput = document.createElement('input');
passwordInput.type = 'password';
passwordInput.id = 'password-input';
passwordInput.placeholder = 'Enter room password';
passwordInput.required = true;
passwordInput.style.cssText = 'width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;margin-bottom:12px';
nameInput.insertAdjacentElement('afterend', passwordInput);

// ==========================================
// 7. AUTO-LOGIN IF NAME SAVED + PASSWORD CACHED
// ==========================================
const savedName = localStorage.getItem('dashtext_username');
const savedPass = localStorage.getItem('dashtext_password');
if (savedName && savedPass === ROOM_PASSWORD) {
  currentUserName = savedName;
  currentUserId = "user_" + Date.now();
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  nameInput.value = savedName;
  initChat();
}

// ==========================================
// 8. LOGIN HANDLER WITH PASSWORD CHECK
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  const enteredPass = document.getElementById('password-input').value;
  
  if (!currentUserName) return;
  
  // Check password
  if (enteredPass !== ROOM_PASSWORD) {
    alert("Wrong password. Ask Pelumi for access.");
    document.getElementById('password-input').value = '';
    return;
  }

  localStorage.setItem('dashtext_username', currentUserName);
  localStorage.setItem('dashtext_password', enteredPass);
  currentUserId = "user_" + Date.now();

  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');

  initChat();
});

// ==========================================
// 9. CHAT FUNCTIONALITY - FIREBASE VERSION
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;

  messageBox.innerHTML = '';
  appendNotice("You're in. Free forever. Firebase connected.");
  
  // Listen for new messages in real-time
  messagesRef.limitToLast(50).on('child_added', (snapshot) => {
    const msg = snapshot.val();
    renderMsg(msg);
  });
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if(!txt) return;
  messageInput.value = '';

  messagesRef.push({
    sender_id: currentUserId,
    sender_name: currentUserName || "User",
    content: txt,
    timestamp: Date.now()
  }).catch((err) => {
    console.error("Failed to send:", err);
    appendNotice("Failed to send. Check internet.");
  });
});

function renderMsg(msg) {
  if (!msg || !msg.content) return;
  
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId ? 'sent' : 'received');
  
  const name = msg.sender_name || "User";
  div.textContent = `${name}: ${msg.content}`;
  
  messageBox.appendChild(div);
  messageBox.scrollTop = messageBox.scrollHeight;
}

function appendNotice(text) {
  const div = document.createElement('div');
  div.style.cssText = 'align-self:center;font-size:12px;color:#54656f;background:#e1f3ff;padding:6px 12px;border-radius:6px;margin:8px 0;text-align:center';
  div.textContent = text;
  messageBox.appendChild(div);
}

// ==========================================
// 10. CALL BUTTON - DISABLED FOR NOW
// ==========================================
callBtn.addEventListener('click', () => {
  alert("Voice calls coming soon. Chat works now.");
});

endCallBtn.addEventListener('click', () => {
  callOverlay.classList.add('hidden');
});
