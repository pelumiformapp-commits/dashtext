// ==========================================
// 1. FIREBASE CONFIG
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
const ROOM_PASSWORD = "pelumi";

// ==========================================
// 3. INIT FIREBASE
// ==========================================
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const messagesRef = database.ref('messages');
const usersRef = database.ref('users');
const callsRef = database.ref('calls');

// ==========================================
// 4. APP STATE
// ==========================================
let currentUserId = "user_" + Date.now();
let currentUserName = "";
let hasInit = false;
let localStream = null;
let peerConnection = null;

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
const remoteAudio = document.getElementById('remote-audio');
const chatList = document.querySelector('.chat-list');

// ==========================================
// 6. ADD PASSWORD FIELD
// ==========================================
const passwordInput = document.createElement('input');
passwordInput.type = 'password';
passwordInput.id = 'password-input';
passwordInput.placeholder = 'Enter room password';
passwordInput.required = true;
passwordInput.style.cssText = 'width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;margin-bottom:12px';
nameInput.insertAdjacentElement('afterend', passwordInput);

// ==========================================
// 7. AUTO-LOGIN
// ==========================================
const savedName = localStorage.getItem('dashtext_username');
const savedPass = localStorage.getItem('dashtext_password');
if (savedName && savedPass === ROOM_PASSWORD) {
  currentUserName = savedName;
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  nameInput.value = savedName;
  initChat();
}

// ==========================================
// 8. LOGIN WITH PASSWORD
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  const enteredPass = document.getElementById('password-input').value;
  
  if (!currentUserName) return;
  if (enteredPass!== ROOM_PASSWORD) {
    alert("Wrong password.");
    document.getElementById('password-input').value = '';
    return;
  }

  localStorage.setItem('dashtext_username', currentUserName);
  localStorage.setItem('dashtext_password', enteredPass);

  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  initChat();
});

// ==========================================
// 9. INIT CHAT + ONLINE STATUS
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;

  // Set user online
  const userStatusRef = usersRef.child(currentUserId);
  userStatusRef.set({ name: currentUserName, online: true, lastSeen: Date.now() });
  userStatusRef.onDisconnect().remove();

  // Load online users
  usersRef.on('value', (snapshot) => {
    renderOnlineUsers(snapshot.val());
  });

  // Load messages
  messagesRef.limitToLast(50).on('child_added', (snapshot) => {
    renderMsg(snapshot.key, snapshot.val());
  });

  // Listen for call invites
  callsRef.child(currentUserId).on('value', (snapshot) => {
    const callData = snapshot.val();
    if (callData && callData.type === 'offer' &&!peerConnection) {
      handleCallOffer(callData);
    }
  });
}

// ==========================================
// 10. SEND MESSAGE
// ==========================================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if(!txt) return;
  messageInput.value = '';

  messagesRef.push({
    sender_id: currentUserId,
    sender_name: currentUserName,
    content: txt,
    timestamp: Date.now()
  });
});

// ==========================================
// 11. RENDER MESSAGE + TIMESTAMP + DELETE
// ==========================================
function renderMsg(msgId, msg) {
  if (!msg ||!msg.content) return;
  
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId? 'sent' : 'received');
  div.dataset.msgId = msgId;
  
  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  div.innerHTML = `
    <div class="msg-content">${msg.sender_name}: ${msg.content}</div>
    <div class="msg-time">${time}</div>
  `;
  
  // Long press to delete your own messages
  if (msg.sender_id === currentUserId) {
    let pressTimer;
    div.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        if (confirm('Delete this message?')) {
          messagesRef.child(msgId).remove();
          div.remove();
        }
      }, 600);
    });
    div.addEventListener('touchend', () => clearTimeout(pressTimer));
    div.addEventListener('mousedown', () => {
      pressTimer = setTimeout(() => {
        if (confirm('Delete this message?')) {
          messagesRef.child(msgId).remove();
          div.remove();
        }
      }, 600);
    });
    div.addEventListener('mouseup', () => clearTimeout(pressTimer));
  }
  
  messageBox.appendChild(div);
  messageBox.scrollTop = messageBox.scrollHeight;
}

// ==========================================
// 12. SHOW WHO'S ONLINE
// ==========================================
function renderOnlineUsers(users) {
  chatList.innerHTML = `
    <div class="chat-item active">
      <div class="avatar">🌐</div>
      <div class="chat-info">
        <div class="chat-name">Global Room</div>
        <div class="chat-preview">Everyone here</div>
      </div>
    </div>
  `;
  
  if (!users) return;
  Object.entries(users).forEach(([uid, user]) => {
    if (uid === currentUserId) return;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
      <div class="avatar">👤</div>
      <div class="chat-info">
        <div class="chat-name">${user.name}</div>
        <div class="chat-preview" style="color:#00a884">Online</div>
      </div>
    `;
    chatList.appendChild(div);
  });
}

// ==========================================
// 13. WEBRTC VOICE CALLS
// ==========================================
const servers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

callBtn.addEventListener('click', async () => {
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Starting call...';
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(servers);
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Broadcast offer to all online users except self
    usersRef.once('value', (snapshot) => {
      const users = snapshot.val() || {};
      Object.keys(users).forEach(uid => {
        if (uid!== currentUserId) {
          callsRef.child(uid).set({
            type: 'offer',
            from: currentUserId,
            fromName: currentUserName,
            offer: offer
          });
        }
      });
    });

    callStatus.textContent = 'Ringing everyone...';
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callsRef.child('candidates').push({
          for: 'all',
          candidate: event.candidate
        });
      }
    };

  } catch (err) {
    callStatus.textContent = 'Mic access denied';
    setTimeout(() => callOverlay.classList.add('hidden'), 2000);
  }
});

async function handleCallOffer(callData) {
  if (!confirm(`${callData.fromName} is calling. Answer?`)) {
    callsRef.child(currentUserId).remove();
    return;
  }
  
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Connecting...';
  
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection(servers);
  
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    callStatus.textContent = 'Connected';
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  callsRef.child(callData.from).set({
    type: 'answer',
    answer: answer
  });
}

endCallBtn.addEventListener('click', () => {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  callsRef.child(currentUserId).remove();
  callOverlay.classList.add('hidden');
  peerConnection = null;
  localStream = null;
});
