// ==========================================
// DASH TEXT - PHASE 1 COMPLETE SCRIPT
// Features: Password, Burn, Anonymous, AI Reply, GIF, Voice Changer, Edit, Delete, Reactions, Themes
// ==========================================

// ==========================================
// 1. FIREBASE CONFIG - REPLACE WITH YOUR OWN
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
let currentTheme = '#d9fdd3';
let burnMode = false;
let anonMode = false;
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
// 9. INIT CHAT + ONLINE STATUS + PHASE 1 BUTTONS
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;

  // Set user online
  const userStatusRef = usersRef.child(currentUserId);
  userStatusRef.set({ name: currentUserName, online: true, lastSeen: Date.now() });
  userStatusRef.onDisconnect().remove();

  // ==========================================
  // PHASE 1 BUTTONS
  // ==========================================
  const burnBtn = document.getElementById('burn-btn');
  const anonBtn = document.getElementById('anon-btn');
  const aiBtn = document.getElementById('ai-btn');
  const gifBtn = document.getElementById('gif-btn');
  const usersBtn = document.getElementById('users-btn');
  const sidebar = document.querySelector('.sidebar');

  if (burnBtn) burnBtn.addEventListener('click', () => {
    burnMode =!burnMode;
    burnBtn.style.opacity = burnMode? '1' : '0.4';
    messageInput.placeholder = burnMode? 'Burn after reading...' : 'Type a message';
  });

  if (anonBtn) anonBtn.addEventListener('click', () => {
    anonMode =!anonMode;
    anonBtn.style.opacity = anonMode? '1' : '0.4';
    messageInput.placeholder = anonMode? 'Sending as Anonymous...' : 'Type a message';
  });

  if (aiBtn) aiBtn.addEventListener('click', async () => {
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

  if (gifBtn) gifBtn.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'gif-modal';
    modal.innerHTML = `
      <div class="gif-modal-content">
        <div class="gif-header">
          <input type="text" id="gif-search" placeholder="Search GIFs..." autofocus>
          <button id="gif-close">✖️</button>
        </div>
        <div class="gif-results" id="gif-results">Type to search Giphy</div>
      </div>
    `;
    document.body.appendChild(modal);

    const searchInput = document.getElementById('gif-search');
    const resultsDiv = document.getElementById('gif-results');
    const closeBtn = document.getElementById('gif-close');

    closeBtn.onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();
      if (!query) {
        resultsDiv.innerHTML = 'Type to search Giphy';
        return;
      }
      resultsDiv.innerHTML = 'Searching...';
      searchTimeout = setTimeout(async () => {
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${query}&limit=12`);
        const data = await res.json();
        resultsDiv.innerHTML = '';
        data.data.forEach(gif => {
          const img = document.createElement('img');
          img.src = gif.images.fixed_height_small.url;
          img.onclick = () => {
            messagesRef.push({
              sender_id: currentUserId,
              sender_name: anonMode? 'Anonymous' : currentUserName,
              content: `<img src="${gif.images.fixed_height.url}" style="max-width:200px;border-radius:8px">`,
              timestamp: Date.now(),
              burn: burnMode
            });
            modal.remove();
          };
          resultsDiv.appendChild(img);
        });
      }, 500);
    });
  });

  if (usersBtn) usersBtn.addEventListener('click', () => {
    if (sidebar.style.display === 'flex') {
      sidebar.style.display = 'none';
    } else {
      sidebar.style.display = 'flex';
      sidebar.style.position = 'absolute';
      sidebar.style.left = '0';
      sidebar.style.top = '0';
      sidebar.style.height = '100%';
      sidebar.style.zIndex = '200';
      sidebar.style.width = '80%';
    }
  });

  // Tap outside to close sidebar
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && sidebar.style.display === 'flex') {
      if (!sidebar.contains(e.target) && e.target!== usersBtn) {
        sidebar.style.display = 'none';
      }
    }
  });

  // ==========================================
  // THEME PICKER - Long press room title
  // ==========================================
  const roomTitle = document.querySelector('.room-title');
  if (roomTitle) {
    roomTitle.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showThemePicker();
    });
    let pressTimer;
    roomTitle.addEventListener('touchstart', () => {
      pressTimer = setTimeout(showThemePicker, 600);
    });
    roomTitle.addEventListener('touchend', () => clearTimeout(pressTimer));
  }

  // ==========================================
  // MESSAGE LISTENERS
  // ==========================================
  messagesRef.limitToLast(50).on('child_added', (snapshot) => {
    renderMsg(snapshot.key, snapshot.val());
  });

  messagesRef.on('child_changed', (snapshot) => {
    const msgDiv = document.querySelector(`[data-msg-id="${snapshot.key}"]`);
    if (msgDiv) {
      msgDiv.remove();
      renderMsg(snapshot.key, snapshot.val());
    }
  });

  messagesRef.on('child_removed', (snapshot) => {
    const msgDiv = document.querySelector(`[data-msg-id="${snapshot.key}"]`);
    if (msgDiv) msgDiv.remove();
  });

  // ==========================================
  // ONLINE USERS
  // ==========================================
  usersRef.on('value', (snapshot) => {
    renderOnlineUsers(snapshot.val());
  });

  // ==========================================
  // CALL LISTENERS
  // ==========================================
  callsRef.child(currentUserId).on('value', (snapshot) => {
    const callData = snapshot.val();
    if (callData && callData.type === 'offer' &&!peerConnection) {
      handleCallOffer(callData);
    }
  });
}

// ==========================================
// 10. SEND MESSAGE + GAMES
// ==========================================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  // Check for games: /tictactoe @Name
  if (text.startsWith('/tictactoe ')) {
    const opponent = text.split(' ')[1]?.replace('@', '');
    if (opponent) {
      messagesRef.push({
        sender_id: currentUserId,
        sender_name: currentUserName,
        content: `🎮 ${currentUserName} challenged ${opponent} to TicTacToe!`,
        timestamp: Date.now(),
        game: 'tictactoe',
        players: [currentUserName, opponent]
      });
      messageInput.value = '';
      return;
    }
  }

  messagesRef.push({
    sender_id: currentUserId,
    sender_name: anonMode? 'Anonymous' : currentUserName,
    content: text,
    timestamp: Date.now(),
    burn: burnMode
  });
  messageInput.value = '';
});

// ==========================================
// 11. RENDER MESSAGE - FIXED DOUBLE NAME BUG
// ==========================================
function renderMsg(msgId, msg) {
  if (!msg ||!msg.content) return;
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId? 'sent' : 'received');
  div.dataset.msgId = msgId;
  if (msg.sender_id === currentUserId) div.style.background = currentTheme;

  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  // FIX: Don't show name for your own messages
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

// ==========================================
// 12. EDIT MESSAGE
// ==========================================
function editMessage(msgId, oldContent) {
  const newContent = prompt('Edit message:', oldContent);
  if (newContent && newContent!== oldContent) {
    messagesRef.child(msgId).update({ content: newContent, edited: true });
  }
}

// ==========================================
// 13. DELETE MESSAGE
// ==========================================
function deleteMessage(msgId, div) {
  div.classList.add('deleting');
  setTimeout(() => messagesRef.child(msgId).remove(), 200);
}

// ==========================================
// 14. REACTIONS
// ==========================================
function showReactionPicker(msgId, x, y) {
  const picker = document.createElement('div');
  picker.className = 'theme-picker';
  picker.style.display = 'block';
  picker.style.left = x? `${x}px` : '50%';
  picker.style.top = y? `${y}px` : '50%';
  picker.style.transform = 'translate(-50%, -50%)';
  
  ['😂', '❤️', '👍', '😮', '😢', '🙏'].forEach(emoji => {
    const btn = document.createElement('span');
    btn.className = 'theme-dot';
    btn.textContent = emoji;
    btn.style.fontSize = '24px';
    btn.onclick = () => {
      toggleReaction(msgId, emoji);
      picker.remove();
    };
    picker.appendChild(btn);
  });
  
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 100);
}

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

// ==========================================
// 15. THEME PICKER
// ==========================================
function showThemePicker() {
  const picker = document.createElement('div');
  picker.className = 'theme-picker';
  picker.style.display = 'block';
  
  ['#d9fdd3', '#c7d2fe', '#fecaca', '#fef08a', '#fbcfe8', '#ddd6fe'].forEach(color => {
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = color;
    dot.onclick = () => {
      currentTheme = color;
      document.querySelectorAll('.msg.sent').forEach(m => m.style.background = color);
      picker.remove();
    };
    picker.appendChild(dot);
  });
  
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 100);
}

// ==========================================
// 16. SHOW WHO'S ONLINE
// ==========================================
function renderOnlineUsers(users) {
  const onlineCount = users? Object.keys(users).length : 0;
  document.querySelector('.status').textContent = `${onlineCount} online`;
  
  chatList.innerHTML = `
    <div class="chat-item active">
      <div class="avatar">🌐</div>
      <div class="chat-info">
        <div class="chat-name">Global Room</div>
        <div class="chat-preview">${onlineCount} online</div>
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
// 17. WEBRTC VOICE CALLS + VOICE CHANGER
// ==========================================
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

callBtn.addEventListener('click', async () => {
  const voice = prompt('Voice changer: robot / alien / chipmunk / none', 'none');
  await startCall(voice);
});

endCallBtn.addEventListener('click', endCall);

async function startCall(voiceType) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    // Voice changer
    if (voiceType!== 'none') {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(localStream);
      const destination = audioCtx.createMediaStreamDestination();
      
      if (voiceType === 'robot') {
        const distortion = audioCtx.createWaveShaper();
        distortion.curve = new Float32Array(44100).map((_, i) => Math.sin(i * 0.1));
        source.connect(distortion).connect(destination);
      } else if (voiceType === 'alien') {
        const osc = audioCtx.createOscillator();
        osc.frequency.value = 100;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.1;
        osc.connect(gain);
        source.connect(gain).connect(destination);
        osc.start();
      } else if (voiceType === 'chipmunk') {
        source.playbackRate = 1.5;
        source.connect(destination);
      }
      localStream = destination.stream;
    }

    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    peerConnection.ontrack = (e) => remoteAudio.srcObject = e.streams[0];
    peerConnection.onicecandidate = (e) => {
      if (e.candidate) callsRef.child('candidates').push({
        for: 'all',
        candidate: e.candidate
      });
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
            offer: offer,
            voice: voiceType
          });
        }
      });
    });

    callOverlay.classList.remove('hidden');
    callStatus.textContent = `Calling with ${voiceType} voice...`;

  } catch (err) {
    callStatus.textContent = 'Mic access denied';
    setTimeout(() => callOverlay.classList.add('hidden'), 2000);
  }
}

async function handleCallOffer(callData) {
  if (!confirm(`${callData.fromName} is calling with ${callData.voice} voice. Answer?`)) {
    callsRef.child(currentUserId).remove();
    return;
  }
  
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Connecting...';
  
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  peerConnection = new RTCPeerConnection(servers);
  
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (e) => {
    remoteAudio.srcObject = e.streams[0];
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

function endCall() {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  callsRef.child(currentUserId).remove();
  callOverlay.classList.add('hidden');
  peerConnection = null;
  localStream = null;
}

// Listen for answers
callsRef.on('child_changed', async (snapshot) => {
  const data = snapshot.val();
  if (data.type === 'answer' && peerConnection &&!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    callStatus.textContent = 'Connected';
  }
});
