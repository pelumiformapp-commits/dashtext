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

const ROOM_PASSWORD = "pelumi"; // Your password
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const messagesRef = database.ref('messages');
const usersRef = database.ref('users');
const callsRef = database.ref('calls');
const gamesRef = database.ref('games');

// ==========================================
// 2. APP STATE
// ==========================================
let currentUserId = "user_" + Date.now();
let currentUserName = "";
let hasInit = false;
let burnMode = false;
let anonMode = false;
let localStream = null;
let peerConnection = null;
let voiceEffect = 'normal';
let currentTheme = localStorage.getItem('dashtheme') || '#d9fdd3';

// ==========================================
// 3. DOM ELEMENTS
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
const burnBtn = document.getElementById('burn-btn');
const anonBtn = document.getElementById('anon-btn');
const aiBtn = document.getElementById('ai-btn');
const gifBtn = document.getElementById('gif-btn');

// ==========================================
// 4. ADD PASSWORD FIELD
// ==========================================
const passwordInput = document.createElement('input');
passwordInput.type = 'password';
passwordInput.id = 'password-input';
passwordInput.placeholder = 'Enter room password';
passwordInput.required = true;
passwordInput.style.cssText = 'width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:16px;margin-bottom:12px';
nameInput.insertAdjacentElement('afterend', passwordInput);

// ==========================================
// 5. THEME PICKER
// ==========================================
const themePicker = document.createElement('div');
themePicker.className = 'theme-picker';
themePicker.innerHTML = `
  <div class="theme-dot" style="background:#d9fdd3" data-color="#d9fdd3"></div>
  <div class="theme-dot" style="background:#ffd9d9" data-color="#ffd9d9"></div>
  <div class="theme-dot" style="background:#d9e3ff" data-color="#d9e3ff"></div>
  <div class="theme-dot" style="background:#fff5d9" data-color="#fff5d9"></div>
  <div class="theme-dot" style="background:#e8d9ff" data-color="#e8d9ff"></div>
`;
document.body.appendChild(themePicker);

document.querySelector('.chat-header').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  themePicker.style.display = themePicker.style.display === 'block'? 'none' : 'block';
});

themePicker.addEventListener('click', (e) => {
  if (e.target.classList.contains('theme-dot')) {
    currentTheme = e.target.dataset.color;
    localStorage.setItem('dashtheme', currentTheme);
    applyTheme();
    themePicker.style.display = 'none';
  }
});

function applyTheme() {
  document.querySelectorAll('.msg.sent').forEach(m => m.style.background = currentTheme);
}
setTimeout(applyTheme, 1000);

// ==========================================
// 6. AUTO-LOGIN
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
// 7. LOGIN
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
// 8. INIT CHAT
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;
  const userStatusRef = usersRef.child(currentUserId);
  userStatusRef.set({ name: currentUserName, online: true, lastSeen: Date.now() });
  userStatusRef.onDisconnect().remove();
  usersRef.on('value', (snapshot) => renderOnlineUsers(snapshot.val()));
  messagesRef.limitToLast(50).on('child_added', (snapshot) => renderMsg(snapshot.key, snapshot.val()));
  messagesRef.on('child_changed', (snapshot) => updateMsg(snapshot.key, snapshot.val()));
  messagesRef.on('child_removed', (snapshot) => document.querySelector(`[data-msg-id="${snapshot.key}"]`)?.remove());
  callsRef.child(currentUserId).on('value', (snapshot) => {
    const callData = snapshot.val();
    if (callData && callData.type === 'offer' &&!peerConnection) handleCallOffer(callData);
  });
}

// ==========================================
// 9. BURN + ANON TOGGLES
// ==========================================
burnBtn.addEventListener('click', () => {
  burnMode =!burnMode;
  burnBtn.style.opacity = burnMode? '1' : '0.4';
  messageInput.placeholder = burnMode? 'Burn after reading...' : 'Type a message';
});

anonBtn.addEventListener('click', () => {
  anonMode =!anonMode;
  anonBtn.style.opacity = anonMode? '1' : '0.4';
  messageInput.placeholder = anonMode? 'Sending as Anonymous...' : 'Type a message';
});

// ==========================================
// 10. SEND MESSAGE + GAMES
// ==========================================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if (!txt) return;

  if (txt.startsWith('/tictactoe')) {
    startTicTacToe(txt);
    messageInput.value = '';
    return;
  }

  messageInput.value = '';
  messagesRef.push({
    sender_id: currentUserId,
    sender_name: anonMode? 'Anonymous' : currentUserName,
    content: txt,
    timestamp: Date.now(),
    burn: burnMode,
    reactions: {}
  });
  burnMode = false;
  anonMode = false;
  burnBtn.style.opacity = '0.4';
  anonBtn.style.opacity = '0.4';
  messageInput.placeholder = 'Type a message';
});

// ==========================================
// 11. RENDER MESSAGE + EDIT + REACTIONS + BURN
// ==========================================
function renderMsg(msgId, msg) {
  if (!msg ||!msg.content) return;
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId? 'sent' : 'received');
  div.dataset.msgId = msgId;
  if (msg.sender_id === currentUserId) div.style.background = currentTheme;

  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  let messageText = msg.content;
  if (msg.sender_id!== currentUserId && msg.sender_name!== 'Anonymous') {
    messageText = `${msg.sender_name}: ${msg.content}`;
  }

  div.innerHTML = `
    <div class="msg-content">${messageText}</div>
    <div class="msg-time">${time}${msg.edited? ' • edited' : ''}</div>
    <div class="reactions"></div>
  `;

  const reactionsDiv = div.querySelector('.reactions');
  if (msg.reactions) {
    Object.entries(msg.reactions).forEach(([emoji, users]) => {
      const r = document.createElement('span');
      r.className = 'reaction';
      r.textContent = `${emoji} ${users.length}`;
      r.onclick = () => toggleReaction(msgId, emoji);
      reactionsDiv.appendChild(r);
    });
  }

  if (msg.sender_id === currentUserId) {
    let lastTap = 0;
    div.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) editMessage(msgId, msg.content);
      lastTap = now;
    });
    div.addEventListener('dblclick', () => editMessage(msgId, msg.content));
  }

  let pressTimer;
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showReactionPicker(msgId, e.pageX, e.pageY);
  });

  div.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      if (msg.sender_id === currentUserId) {
        if (confirm('Delete this message?')) deleteMessage(msgId, div);
      } else {
        showReactionPicker(msgId);
      }
    }, 600);
  });
  div.addEventListener('touchend', () => clearTimeout(pressTimer));

  messageBox.appendChild(div);
  messageBox.scrollTop = messageBox.scrollHeight;

  if (msg.sender_id!== currentUserId && msg.burn) {
    setTimeout(() => {
      div.style.opacity = '0.3';
      div.querySelector('.msg-content').innerHTML = '🔥 Message burned';
      setTimeout(() => messagesRef.child(msgId).remove(), 1000);
    }, 10000);
  }
}

function updateMsg(msgId, msg) {
  const div = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (div) {
    div.remove();
    renderMsg(msgId, msg);
  }
}

function deleteMessage(msgId, div) {
  div.classList.add('deleting');
  setTimeout(() => messagesRef.child(msgId).remove(), 200);
}

function editMessage(msgId, oldText) {
  const newText = prompt('Edit message:', oldText);
  if (newText && newText!== oldText) {
    messagesRef.child(msgId).update({ content: newText, edited: true });
  }
}

// ==========================================
// 12. REACTIONS + GIFS
// ==========================================
function toggleReaction(msgId, emoji) {
  const ref = messagesRef.child(msgId).child('reactions').child(emoji);
  ref.transaction((current) => {
    if (!current) return [currentUserId];
    const idx = current.indexOf(currentUserId);
    if (idx === -1) current.push(currentUserId);
    else current.splice(idx, 1);
    return current.length? current : null;
  });
}

function showReactionPicker(msgId, x, y) {
  const emojis = ['❤️','😂','😮','😢','👍','🔥'];
  const picker = document.createElement('div');
  picker.style.cssText = `position:fixed;left:${x||'50%'};top:${y||'50%'};background:white;padding:8px;border-radius:20px;box-shadow:0 2px 10px rgba(0,0,0,0.3);z-index:999;`;
  emojis.forEach(e => {
    const b = document.createElement('span');
    b.textContent = e;
    b.style.cssText = 'font-size:24px;padding:4px;cursor:pointer;';
    b.onclick = () => { toggleReaction(msgId, e); picker.remove(); };
    picker.appendChild(b);
  });
  document.body.appendChild(picker);
  setTimeout(() => picker.remove(), 3000);
}

gifBtn.addEventListener('click', async () => {
  const query = prompt('Search GIF:');
  if (!query) return;
  const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${query}&limit=1`);
  const data = await res.json();
  if (data.data[0]) {
    messagesRef.push({
      sender_id: currentUserId,
      sender_name: anonMode? 'Anonymous' : currentUserName,
      content: `<img src="${data.data[0].images.fixed_height.url}" style="max-width:200px;border-radius:8px">`,
      timestamp: Date.now(),
      burn: burnMode
    });
  }
});

// ==========================================
// 13. AI REPLY SUGGESTIONS
// ==========================================
aiBtn.addEventListener('click', async () => {
  aiBtn.textContent = '⏳';
  const lastMsg = document.querySelector('.msg.received:last-child.msg-content');
  const prompt = lastMsg? `Reply to: "${lastMsg.textContent}"` : 'Start a fun conversation';
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt })
    });
    const data = await res.json();
    const reply = data[0]?.generated_text || 'How far na? 😂';
    messageInput.value = reply;
  } catch {
    messageInput.value = 'You too much 😂';
  }
  aiBtn.textContent = '⚡';
});

// ==========================================
// 14. TIC TAC TOE GAME
// ==========================================
function startTicTacToe(txt) {
  const mention = txt.split('@')[1]?.trim();
  if (!mention) return alert('Tag someone: /tictactoe @Tayo');
  const gameId = 'game_' + Date.now();
  gamesRef.child(gameId).set({
    type: 'tictactoe',
    players: [currentUserName, mention],
    board: ['','','','','','','','',''],
    turn: currentUserName,
    status: 'playing'
  });
  messagesRef.push({
    sender_id: 'system',
    sender_name: 'DashText',
    content: `🎮 ${currentUserName} challenged ${mention} to TicTacToe! Type /move 1-9 to play`,
    timestamp: Date.now()
  });
}

// ==========================================
// 15. VOICE CHANGER ON CALLS
// ==========================================
callBtn.addEventListener('click', async () => {
  const effect = prompt('Voice effect? normal/robot/chipmunk', 'normal');
  voiceEffect = effect;
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Starting call...';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (voiceEffect!== 'normal') {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(localStream);
      const destination = audioCtx.createMediaStreamDestination();
      if (voiceEffect === 'robot') {
        const distortion = audioCtx.createWaveShaper();
        distortion.curve = new Float32Array(44100).map((_, i) => Math.sin(i * 0.1) * 0.5);
        source.connect(distortion).connect(destination);
      } else if (voiceEffect === 'chipmunk') {
        const pitchShift = audioCtx.createBiquadFilter();
        pitchShift.type = 'highpass';
        pitchShift.frequency.value = 1000;
        source.connect(pitchShift).connect(destination);
      }
      localStream = destination.stream;
    }

    peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = (e) => { remoteAudio.srcObject = e.streams[0]; };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    usersRef.once('value', (snapshot) => {
      const users = snapshot.val() || {};
      Object.keys(users).forEach(uid => {
        if (uid!== currentUserId) {
          callsRef.child(uid).set({ type: 'offer', from: currentUserId, fromName: currentUserName, offer: offer, effect: voiceEffect });
        }
      });
    });
    callStatus.textContent = `Ringing with ${voiceEffect} voice...`;
  } catch (err) {
    callStatus.textContent = 'Mic access denied';
    setTimeout(() => callOverlay.classList.add('hidden'), 2000);
  }
});

async function handleCallOffer(callData) {
  if (!confirm(`${callData.fromName} is calling with ${callData.effect} voice. Answer?`)) {
    callsRef.child(currentUserId).remove();
    return;
  }
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Connecting...';
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  peerConnection.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0];
    callStatus.textContent = 'Connected';
  };
  await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  callsRef.child(callData.from).set({ type: 'answer', answer: answer });
}

endCallBtn.addEventListener('click', () => {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  callsRef.child(currentUserId).remove();
  callOverlay.classList.add('hidden');
  peerConnection = null;
  localStream = null;
});

// ==========================================
// 16. ONLINE USERS
// ==========================================
function renderOnlineUsers(users) {
  chatList.innerHTML = `<div class="chat-item active"><div class="avatar">🌐</div><div class="chat-info"><div class="chat-name">Global Room</div><div class="chat-preview">Everyone here</div></div></div>`;
  if (!users) return;
  Object.entries(users).forEach(([uid, user]) => {
    if (uid === currentUserId) return;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar">👤</div><div class="chat-info"><div class="chat-name">${user.name}</div><div class="chat-preview" style="color:#00a884">Online</div></div>`;
    chatList.appendChild(div);
  });
}
