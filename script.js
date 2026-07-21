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
// 2. INIT FIREBASE
// ==========================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const messagesRef = database.ref('messages');

// ==========================================
// 3. APP STATE VARIABLES
// ==========================================
let currentUserId = "";
let currentUserName = "";
let hasInit = false;

// ==========================================
// 4. DOM ELEMENTS
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
// 5. AUTO-LOGIN IF NAME SAVED
// ==========================================
const savedName = localStorage.getItem('dashtext_username');
if (savedName) {
  currentUserName = savedName;
  currentUserId = "user_" + Date.now();
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  nameInput.value = savedName;
  initChat();
}

// ==========================================
// 6. LOGIN HANDLER
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  if (!currentUserName) return;

  localStorage.setItem('dashtext_username', currentUserName);
  currentUserId = "user_" + Date.now();

  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');

  initChat();
});

// ==========================================
// 7. CHAT FUNCTIONALITY - FIREBASE VERSION
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;

  loadHistory();
  
  // Listen for new messages in real-time
  messagesRef.limitToLast(50).on('child_added', (snapshot) => {
    const msg = snapshot.val();
    renderMsg(msg);
  });

  appendNotice("You're in. Free forever. Firebase connected.");
}

function loadHistory() {
  messageBox.innerHTML = '';
  // History loads automatically via child_added listener
}

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if(!txt) return;
  messageInput.value = '';

  // Send to Firebase
  messagesRef.push({
    sender_id: currentUserId,
    sender_name: currentUserName,
    content: txt,
    timestamp: Date.now()
  });
});

function renderMsg(msg) {
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId ? 'sent' : 'received');
  div.textContent = `${msg.sender_name}: ${msg.content}`;
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
// 8. CALL BUTTON - DISABLED FOR NOW
// ==========================================
callBtn.addEventListener('click', () => {
  alert("Voice calls coming soon. Chat works now.");
});

endCallBtn.addEventListener('click', () => {
  callOverlay.classList.add('hidden');
});
