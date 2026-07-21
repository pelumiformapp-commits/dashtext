// ==========================================
// 1. PLACE YOUR REAL SUPABASE CREDENTIALS HERE
// ==========================================

const SUPABASE_URL = "https://pbomqjfpfefnoklggyns.co";
const SUPABASE_ANON_KEY = "sb_publishable_Uiw1DEW6umf6BehneSvi6g_ArM9UOhO";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. APP STATE VARIABLES
// ==========================================
let currentUserId = "";
let currentUserName = "";
const currentRoomId = "global-demo-room";
let peerConnection = null, localStream = null, callChannel = null;
let hasInit = false; // <-- ADDED: Stops lag

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

// ==========================================
// 4. AUTO-LOGIN IF NAME SAVED
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
// 5. LOGIN HANDLER
// ==========================================
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  if (!currentUserName) return;

  localStorage.setItem('dashtext_username', currentUserName); // <-- ADDED: Saves name
  currentUserId = "user_" + Date.now();

  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');

  initChat();
});

// ==========================================
// 6. CHAT FUNCTIONALITY
// ==========================================
function initChat() {
  if (hasInit) return; // <-- ADDED: Fixes lag
  hasInit = true; // <-- ADDED: Fixes lag

  loadHistory();

  try {
    supabaseClient
     .channel(`room:${currentRoomId}`)
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` }, (p) => {
          renderMsg(p.new);
        })
     .subscribe();
  } catch (err) {
    console.error("Realtime subscription error:", err);
  }

  appendNotice("You're in. Free forever. Max 30 days history.");
}

async function loadHistory() {
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  try {
    const { data, error } = await supabaseClient
     .from('messages')
     .select('*')
     .eq('room_id', currentRoomId)
     .gte('created_at', thirtyDaysAgo)
     .order('created_at', { ascending: false })
     .limit(50); // <-- ADDED: Faster loading

    if (error) throw error;

    messageBox.innerHTML = '';
    data?.reverse().forEach(renderMsg);
  } catch (err) {
    console.error("Failed to load chat history:", err.message);
    appendNotice("Database connection failed. Showing offline mode.");
  }
}

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if(!txt) return;
  messageInput.value = '';

  try {
    await supabaseClient.from('messages').insert([{
      room_id: currentRoomId,
      sender_id: currentUserId,
      content: `${currentUserName}: ${txt}`
    }]);
  } catch (err) {
    console.error("Failed to send message:", err);
  }
});

function renderMsg(msg) {
  const div = document.createElement('div');
  div.classList.add('msg');
  div.classList.add(msg.sender_id === currentUserId? 'sent' : 'received');
  div.textContent = msg.content;
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
// 7. WEBRTC AUDIO CALL FUNCTIONALITY
// ==========================================
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // <-- FIXED
let callDuration = 0, callTimer = null;

callBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    callOverlay.classList.remove('hidden');
    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    peerConnection.ontrack = (e) => {
      remoteAudio.srcObject = e.streams[0];
      callStatus.textContent = "Connected";
      callTimer = setInterval(() => {
        if (++callDuration >= 300) {
          endCall();
          appendNotice("Free calls limited to 5 mins");
        }
      }, 1000);
    };

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) callChannel.send({ type: 'broadcast', event: 'ice', payload: { candidate: e.candidate, sender: currentUserId } });
    };

    callChannel = supabaseClient.channel(`call:${currentRoomId}`)
   .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.sender === currentUserId) return;
        await peerConnection.setRemoteDescription(payload.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        callChannel.send({ type: 'broadcast', event: 'answer', payload: { answer, sender: currentUserId } });
      })
   .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.sender!== currentUserId) await peerConnection.setRemoteDescription(payload.answer);
      })
   .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload.sender!== currentUserId) await peerConnection.addIceCandidate(payload.candidate);
      })
   .subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          callChannel.send({ type: 'broadcast', event: 'offer', payload: { offer, sender: currentUserId } });
          callStatus.textContent = "Ringing...";
        }
      });
  } catch (err) {
    callStatus.textContent = "Mic denied. Use HTTPS.";
    console.error(err);
    setTimeout(() => callOverlay.classList.add('hidden'), 2000);
  }
});

function endCall() {
  clearInterval(callTimer);
  callDuration = 0;
  localStream?.getTracks().forEach(t => t.stop());
  peerConnection?.close();
  if (callChannel) supabaseClient.removeChannel(callChannel);
  callOverlay.classList.add('hidden');
  remoteAudio.srcObject = null;
}
endCallBtn.addEventListener('click', endCall);





