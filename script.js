// PASTE YOUR SUPABASE URL + KEY HERE
const SUPABASE_URL = "https://pbomqjfpfeeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib21xamZwZmVmbm9rbGdneW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDY4NDQsImV4cCI6MjEwMDIyMjg0NH0.sIdL5Tu5RlTsEq5lvvZEsc3sxYtDbeKcDO5zticHNp0.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib21xamZwZmVmbm9rbGdneW5zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY0Njg0NCwiZXhwIjoyMTAwMjIyODQ0fQ.vC9wj7lBepl-G9AwUcy9SXODJDa2Gqm_FKqRrhd_QaU";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUserId = "";
let currentUserName = "";
const currentRoomId = "global-demo-room";
let peerConnection = null, localStream = null, callChannel = null;
let hasInit = false; // <-- LINE 5: ADD THIS

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

// Auto-login if name saved
const savedName = localStorage.getItem('dashtext_username');
if (savedName) {
  currentUserName = savedName;
  currentUserId = "user_" + Date.now();
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  nameInput.value = savedName;
  initChat();
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentUserName = nameInput.value.trim();
  if (!currentUserName) return;

  // Save name so it doesn't disappear
  localStorage.setItem('dashtext_username', currentUserName);

  currentUserId = "user_" + Date.now();
  loginScreen.classList.remove('active-screen');
  mainChatScreen.classList.add('active-screen');
  initChat();
});

function initChat() {
  if (hasInit) return; // <-- ADD THIS: Stops double-loading
  hasInit = true; // <-- ADD THIS

  loadHistory();
  supabaseClient
.channel(`room:${currentRoomId}`)
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoomId}` }, (p) => {
      renderMsg(p.new);
    })
.subscribe();
  appendNotice("You're in. Free forever. Max 30 days history.");
}

async function loadHistory() {
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const { data } = await supabaseClient
   .from('messages')
   .select('*')
   .eq('room_id', currentRoomId)
   .gte('created_at', thirtyDaysAgo)
   .order('created_at', { ascending: false })
   .limit(50); // <-- ADD THIS: Only load 50 msgs = faster
  messageBox.innerHTML = '';
  data?.reverse().forEach(renderMsg);
}

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const txt = messageInput.value.trim();
  if(!txt) return;
  messageInput.value = '';
  await supabaseClient.from('messages').insert([{
    room_id: currentRoomId,
    sender_id: currentUserId,
    content: `${currentUserName}: ${txt}`
  }]);
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

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
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
  }
});

endCallBtn.addEventListener('click', endCall);

function endCall() {
  clearInterval(callTimer);
  callDuration = 0;
  localStream?.getTracks().forEach(t => t.stop());
  peerConnection?.close();
  callChannel?.unsubscribe();
  callOverlay.classList.add('hidden');
  callStatus.textContent = "Call ended";
    }
