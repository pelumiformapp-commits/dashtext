// ==========================================
// DASH TEXT - COMPLETE WITH SETTINGS + COLOR + SIZE + PRIVATE ROOMS
// ==========================================

// ==========================================
// 1. FIREBASE CONFIG - USE YOUR OWN
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
const usersRef = database.ref('users');
const callsRef = database.ref('calls');
let messagesRef = null;

// ==========================================
// 4. APP STATE
// ==========================================
let currentUserId = "user_" + Date.now();
let currentUserName = "";
let currentRoom = "Global Room";
let currentTheme = localStorage.getItem('dashtext_theme') || '#d9fdd3';
let currentBgColor = localStorage.getItem('dashtext_bg') || '#efeae2';
let fontSize = localStorage.getItem('dashtext_font') || '14';
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
const passwordInput = document.getElementById('password-input');
const roomInput = document.getElementById('room-input');
const messageBox = document.getElementById('message-box');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const callBtn = document.getElementById('call-btn');
const callOverlay = document.getElementById('call-overlay');
const endCallBtn = document.getElementById('end-call-btn');
const callStatus = document.getElementById('call-status');
const remoteAudio = document.getElementById('remote-audio');
const chatList = document.querySelector('.chat-list');
const editNameBtn = document.getElementById('edit-name-btn');
const themeBtn = document.getElementById('theme-btn');
const fontBtn = document.getElementById('font-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');

// ==========================================
// 6. AUTO-LOGIN WITH NAME SAVE
// ==========================================
const savedName = localStorage.getItem('dashtext_username');
const savedPass = localStorage.getItem('dashtext_password');
const savedRoom = localStorage.getItem('dashtext_room') || 'Global Room';

if (savedName && savedPass === ROOM_PASSWORD) {
  currentUserName = savedName;
  currentRoom = savedRoom;
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  if (nameInput) nameInput.value = savedName;
  if (roomInput) roomInput.value = savedRoom === 'Global Room'? '' : savedRoom;
  initChat();
}

// ==========================================
// 7. LOGIN WITH PASSWORD + ROOM
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  const enteredPass = passwordInput.value;
  currentRoom = roomInput.value.trim() || 'Global Room';

  if (!currentUserName) return;
  if (enteredPass!== ROOM_PASSWORD) {
    alert("Wrong password.");
    passwordInput.value = '';
    return;
  }

  localStorage.setItem('dashtext_username', currentUserName);
  localStorage.setItem('dashtext_password', enteredPass);
  localStorage.setItem('dashtext_room', currentRoom);

  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  initChat();
});

// ==========================================
// 8. CHANGE NAME FUNCTION
// ==========================================
function changeName() {
  const newName = prompt('Enter new name:', currentUserName);
  if (newName && newName!== currentUserName) {
    const oldName = currentUserName;
    currentUserName = newName;
    localStorage.setItem('dashtext_username', currentUserName);
    
    usersRef.child(currentUserId).update({ name: currentUserName });
    
    messagesRef.push({
      sender_id: 'system',
      sender_name: 'System',
      content: `${oldName} changed name to ${newName}`,
      timestamp: Date.now(),
      system: true
    });
    
    document.querySelector('.user-avatar').innerText = currentUserName.charAt(0).toUpperCase();
  }
}
if (editNameBtn) editNameBtn.addEventListener('click', changeName);

// ==========================================
// 9. THEME PICKER - COLOR CONTROL
// ==========================================
function showThemePicker() {
  const picker = document.createElement('div');
  picker.className = 'theme-picker';
  picker.style.display = 'block';
  picker.style.width = '280px';
  picker.innerHTML = '<div style="font-size:13px;margin-bottom:8px;text-align:center;font-weight:600">Message Bubble</div>';
  
  ['#d9fdd3', '#c7d2fe', '#fecaca', '#fef08a', '#fbcfe8', '#ddd6fe', '#111b21', '#ffffff'].forEach(color => {
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = color;
    dot.style.border = color === '#ffffff'? '2px solid #ccc' : 'none';
    dot.onclick = () => {
      currentTheme = color;
      localStorage.setItem('dashtext_theme', color);
      document.querySelectorAll('.msg.sent').forEach(m => {
        m.style.background = color;
        m.style.color = color === '#111b21' || color === '#000000'? '#fff' : '#111b21';
      });
      picker.remove();
    };
    picker.appendChild(dot);
  });
  
  const bgLabel = document.createElement('div');
  bgLabel.style.cssText = 'font-size:13px;margin:12px 0 8px;text-align:center;font-weight:600;border-top:1px solid #eee;padding-top:8px';
  bgLabel.innerText = 'Chat Background';
  picker.appendChild(bgLabel);
  
  ['#efeae2', '#0b141a', '#1e1e1e', '#f0f2f5', '#ffe4e1', '#e0f2fe', '#1a1a1a', '#fafafa'].forEach(color => {
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.style.background = color;
    dot.style.border = '2px solid #ccc';
    dot.onclick = () => {
      currentBgColor = color;
      localStorage.setItem('dashtext_bg', color);
      document.querySelector('.chat-window').style.background = color;
      picker.remove();
    };
    picker.appendChild(dot);
  });
  
  document.body.appendChild(picker);
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 100);
}

if (themeBtn) themeBtn.addEventListener('click', showThemePicker);

// ==========================================
// 10. FONT SIZE CONTROL
// ==========================================
function changeFontSize() {
  const newSize = prompt('Enter font size (12-20):', fontSize);
  if (newSize && newSize >= 12 && newSize <= 20) {
    fontSize = newSize;
    localStorage.setItem('dashtext_font', fontSize);
    document.body.style.fontSize = fontSize + 'px';
    document.querySelectorAll('.msg').forEach(m => m.style.fontSize = fontSize + 'px');
  }
}

if (fontBtn) fontBtn.addEventListener('click', changeFontSize);

// ==========================================
// 11. SETTINGS MODAL
// ==========================================
if (settingsBtn) settingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
  document.getElementById('current-room-display').innerText = currentRoom;
});

if (settingsClose) settingsClose.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.style.display = 'none';
});

document.getElementById('change-name-setting')?.addEventListener('click', () => {
  settingsModal.style.display = 'none';
  changeName();
});

document.getElementById('change-room-setting')?.addEventListener('click', () => {
  const newRoom = prompt('Enter room code:\nLeave empty for Global Room', currentRoom === 'Global Room'? '' : currentRoom);
  if (newRoom!== null) {
    const room = newRoom.trim() || 'Global Room';
    if (room!== currentRoom) {
      localStorage.setItem('dashtext_room', room);
      location.reload();
    }
    settingsModal.style.display = 'none';
  }
});

document.getElementById('theme-setting')?.addEventListener('click', () => {
  settingsModal.style.display = 'none';
  showThemePicker();
});

document.getElementById('font-setting')?.addEventListener('click', () => {
  settingsModal.style.display = 'none';
  changeFontSize();
});

document.getElementById('clear-chat-setting')?.addEventListener('click', () => {
  if (confirm(`Delete all messages in "${currentRoom}"?\n\nThis only affects this room.`)) {
    messagesRef.remove();
    settingsModal.style.display = 'none';
  }
});

document.getElementById('logout-setting')?.addEventListener('click', () => {
  if (confirm('Logout? Your name and room will be cleared.')) {
    localStorage.removeItem('dashtext_username');
    localStorage.removeItem('dashtext_password');
    localStorage.removeItem('dashtext_room');
    location.reload();
  }
});

// ==========================================
// 12. INIT CHAT
// ==========================================
function initChat() {
  if (hasInit) return;
  hasInit = true;

  const roomKey = currentRoom.replace(/[^a-zA-Z0-9]/g, '_');
  messagesRef = database.ref(`rooms/${roomKey}/messages`);

  document.querySelector('.room-title').innerText = currentRoom;
  document.querySelector('.user-avatar').innerText = currentUserName.charAt(0).toUpperCase();
  document.querySelector('.chat-window').style.background = currentBgColor;
  document.body.style.fontSize = fontSize + 'px';

  const userStatusRef = usersRef.child(currentUserId);
  userStatusRef.set({ name: currentUserName, online: true, room: currentRoom, lastSeen: Date.now() });
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
              burn: burnMode,
              readBy: [currentUserId]
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

  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768 && sidebar.style.display === 'flex') {
      if (!sidebar.contains(e.target) && e.target!== usersBtn) {
        sidebar.style.display = 'none';
      }
    }
  });

  // Theme picker on room title
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
  messageBox.innerHTML = '';
  messagesRef.limitToLast(50).on('child_added', (snapshot) => {
    renderMsg(snapshot.key, snapshot.val());

    const msg = snapshot.val();
    if (msg.sender_id!== currentUserId &&!msg.system &&!msg.readBy?.includes(currentUserId)) {
      const readBy = msg.readBy || [];
      readBy.push(currentUserId);
      messagesRef.child(snapshot.key).update({ readBy });
    }
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

  usersRef.on('value', (snapshot) => {
    renderOnlineUsers(snapshot.val());
  });

  callsRef.child(currentUserId).on('value', (snapshot) => {
    const callData = snapshot.val();
    if (callData && callData.type === 'offer' &&!peerConnection) {
      handleCallOffer(callData);
    }
  });
}

// ==========================================
// 13. SEND MESSAGE + GAMES
// ==========================================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  if (text.startsWith('/tictactoe ')) {
    const opponent = text.split(' ')[1]?.replace('@', '');
    if (opponent) {
      messagesRef.push({
        sender_id: currentUserId,
        sender_name: currentUserName,
        content: `🎮 ${currentUserName} challenged ${opponent} to TicTacToe!`,
        timestamp: Date.now(),
        game: 'tictactoe',
        players: [currentUserName, opponent],
        readBy: [currentUserId]
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
    burn: burnMode,
    readBy: [currentUserId]
  });
  messageInput.value = '';
});

// ==========================================
// 14. RENDER MESSAGE - WITH COLOR + SIZE
// ==========================================
function renderMsg(msgId, msg) {
  if (!msg ||!msg.content) return;
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId? 'sent' : 'received');
  div.dataset.msgId = msgId;
  
  if (msg.sender_id === currentUserId) {
    div.style.background = currentTheme;
    div.style.color = currentTheme === '#111b21' || currentTheme === '#000000'? '#fff' : '#111b21';
    div.style.fontSize = fontSize + 'px';
  } else {
    div.style.fontSize = fontSize + 'px';
  }

  const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  let ticks = '';
  if (msg.sender_id === currentUserId &&!msg.system) {
    const readCount = msg.readBy?.length || 1;
    ticks = readCount > 1? ' ✓✓' : ' ✓';
  }

  let messageText = msg.content;
  if (msg.sender_id!== currentUserId && msg.sender_name!== 'Anonymous' &&!msg.system) {
    messageText = `${msg.sender_name}: ${msg.content}`;
  }

  div.innerHTML = `
    <div class="msg-content">${messageText}</div>
    <div class="msg-time">${time}${msg.edited? ' • edited' : ''}${ticks}</div>
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

  if (msg.sender_id === currentUserId &&!msg.system) {
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
// 15. EDIT MESSAGE
// ==========================================
function editMessage(msgId, oldContent) {
  const newContent = prompt('Edit message:', oldContent);
  if (newContent && newContent!== oldContent) {
    messagesRef.child(msgId).update({ content: newContent, edited: true });
  }
}

// ==========================================
// 16. DELETE MESSAGE
// ==========================================
function deleteMessage(msgId, div) {
  div.classList.add('deleting');
  setTimeout(() => messagesRef.child(msgId).remove(), 200);
}

// ==========================================
// 17. REACTIONS
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
// 18. SHOW WHO'S ONLINE - ROOM SPECIFIC
// ==========================================
function renderOnlineUsers(users) {
  const roomUsers = users? Object.entries(users).filter(([uid, user]) => user.room === currentRoom) : [];
  const onlineCount = roomUsers.length;

  document.querySelector('.status').textContent = `${onlineCount} online`;

  chatList.innerHTML = `
    <div class="chat-item active">
      <div class="avatar">🌐</div>
      <div class="chat-info">
        <div class="chat-name">${currentRoom}</div>
        <div class="chat-preview">${onlineCount} online</div>
      </div>
    </div>
  `;

  roomUsers.forEach(([uid, user]) => {
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
// 19. WEBRTC VOICE CALLS + TURN FIX
// ==========================================
const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

callBtn.addEventListener('click', async () => {
  const voice = prompt('Voice changer: robot / alien / chipmunk / none', 'none');
  await startCall(voice);
});

endCallBtn.addEventListener('click', endCall);

async function startCall(voiceType) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

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

    usersRef.once('value', (snapshot) => {
      const users = snapshot.val() || {};
      Object.keys(users).forEach(uid => {
        if (uid!== currentUserId && users[uid].room === currentRoom) {
          callsRef.child(uid).set({
            type: 'offer',
            offer: offer,
            from: currentUserId
          });
        }
      });
    });

    callOverlay.classList.remove('hidden');
    callStatus.textContent = 'Calling...';
  } catch (err) {
    alert('Mic access denied');
  }
}

async function handleCallOffer(callData) {
  callOverlay.classList.remove('hidden');
  callStatus.textContent = 'Incoming call...';

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  peerConnection = new RTCPeerConnection(servers);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (e) => remoteAudio.srcObject = e.streams[0];
  peerConnection.onicecandidate = (e) => {
    if (e.candidate) callsRef.child('candidates').push({
      for: callData.from,
      candidate: e.candidate
    });
  };

  await peerConnection.setRemoteDescription(callData.offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  callsRef.child(callData.from).set({
    type: 'answer',
    answer: answer,
    from: currentUserId
  });

  callStatus.textContent = 'Connected';
}

function endCall() {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  callOverlay.classList.add('hidden');
  callsRef.child(currentUserId).remove();
  peerConnection = null;
  localStream = null;
}

// ==========================================
// 20. LOAD SAVED THEME ON STARTUP
// ==========================================
window.addEventListener('load', () => {
  const savedName = localStorage.getItem('dashtext_username');
  if (savedName) document.getElementById('name-input').value = savedName;
  document.querySelector('.chat-window').style.background = currentBgColor;
  document.body.style.fontSize = fontSize + 'px';
});
