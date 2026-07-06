// --- REFERENCIAS DOM ---
const viewHome = document.getElementById('view-home');
const viewChat = document.getElementById('view-chat');
const viewLive = document.getElementById('view-live');
const viewDaily = document.getElementById('view-daily');
const btnHome = document.getElementById('btn-home');

// --- SISTEMA DE NAVEGACIÓN ---
function showView(view) {
    viewHome.classList.add('hidden');
    viewChat.classList.add('hidden');
    viewLive.classList.add('hidden');
    viewDaily.classList.add('hidden');
    view.classList.remove('hidden');
    btnHome.classList.toggle('hidden', view === viewHome);
}

document.getElementById('btn-nav-live').addEventListener('click', () => showView(viewLive));

document.getElementById('btn-nav-daily').addEventListener('click', () => {
    showView(viewDaily);
    document.getElementById('daily-intro').classList.remove('hidden');
    document.getElementById('daily-chat-container').classList.add('hidden');
    document.getElementById('daily-chat-history').innerHTML = '';
    document.getElementById('daily-input').value = '';
});

document.getElementById('btn-back-daily').addEventListener('click', () => showView(viewHome));

btnHome.addEventListener('click', () => showView(viewHome));

// ==========================================
// FLUJO 1: ROLEPLAY (Práctica interactiva)
// ==========================================
const homeInput = document.getElementById('home-input');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');

document.getElementById('btn-start-exp').addEventListener('click', () => {
    const topic = homeInput.value.trim();
    if (topic) {
        showView(viewChat);
        chatHistory.innerHTML = ''; 
        sendChatMessage(`I want to practice: ${topic}`, true);
    }
});

document.getElementById('btn-send-chat').addEventListener('click', () => sendChatMessage(chatInput.value));
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(chatInput.value); });

async function sendChatMessage(text, isInit = false) {
    if (!text.trim()) return;

    if (!isInit) {
        chatHistory.innerHTML += `<div class="msg-user">${text}</div>`;
        chatInput.value = '';
    }

    try {
        // FIX: ruta relativa. Antes: 'http://localhost:3001/api/chat'.
        // Así funciona igual en local que en producción (Render, etc.),
        // porque siempre apunta al mismo host que sirvió la página.
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: 'roleplay' })
        });

        const data = await response.json();

        if (data.correction) showToast(data.correction.explanation, data.correction.correction);

        chatHistory.innerHTML += `<div class="msg-actor"><strong>Actor:</strong> ${data.actorResponse}</div>`;
        document.getElementById('side-focus').innerText = data.theme;
        chatHistory.scrollTop = chatHistory.scrollHeight;

    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// FLUJO 2: LIVE COACH (Auditor Pasivo)
// ==========================================
const btnListen = document.getElementById('btn-start-listening');
const transcriptionBox = document.getElementById('live-transcription');
const correctionsBox = document.getElementById('live-corrections');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'en-US';
recognition.continuous = true;
let isListening = false;

btnListen.addEventListener('click', () => {
    isListening ? recognition.stop() : recognition.start();
    isListening = !isListening;
    btnListen.innerText = isListening ? "⏹ Detener escucha" : "🎤 Empezar a escuchar";
    btnListen.style.background = isListening ? "#dc2626" : "linear-gradient(90deg, #4f46e5, #3b82f6)";
});

recognition.onresult = async (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            const finalTranscript = event.results[i][0].transcript;
            transcriptionBox.innerHTML = `"${finalTranscript}"`;
            checkLiveGrammar(finalTranscript);
        }
    }
};

async function checkLiveGrammar(text) {
    correctionsBox.innerHTML = "<i>Analizando gramática y contexto...</i>";

    const currentContext = document.getElementById('live-context')?.value || "General casual conversation";

    try {
        // FIX: ruta relativa, igual que en sendChatMessage.
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text, 
                mode: 'live_coach',
                context: currentContext 
            }) 
        });

        const data = await response.json();
        if (data.correction) {
            correctionsBox.innerHTML = `
                <div style="color:#ff9999; margin-bottom: 8px;">⚠️ ${data.correction.explanation}</div>
                <div style="color:white; font-size:1.1rem;">Versión natural: <b>${data.correction.correction}</b></div>`;
        } else {
            correctionsBox.innerHTML = `<span style="color:#34d399">✨ ¡Perfecto para este contexto!</span>`;
            setTimeout(() => correctionsBox.innerHTML = "", 4000);
        }
    } catch (e) {
        console.error(e);
        correctionsBox.innerHTML = "<span style='color:red'>Error de conexión con la IA.</span>";
    }
}

// ==========================================
// FLUJO 3: DAILY COACH (Clase complementaria)
// ==========================================
const dailyInput = document.getElementById('daily-input');
const dailyIntro = document.getElementById('daily-intro');
const dailyChatContainer = document.getElementById('daily-chat-container');
const dailyChatHistory = document.getElementById('daily-chat-history');
const dailyChatInput = document.getElementById('daily-chat-input');
const dailySideUnit = document.getElementById('daily-side-unit');

document.getElementById('btn-start-daily').addEventListener('click', () => {
    const topic = dailyInput.value.trim();
    if (topic) {
        dailyIntro.classList.add('hidden');
        dailyChatContainer.classList.remove('hidden');
        sendDailyMessage(`Today I studied: ${topic}`, true);
    }
});

document.getElementById('btn-send-daily').addEventListener('click', () => sendDailyMessage(dailyChatInput.value));
dailyChatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendDailyMessage(dailyChatInput.value); });

async function sendDailyMessage(text, isInit = false) {
    if (!text.trim()) return;

    if (!isInit) {
        dailyChatHistory.innerHTML += `<div class="msg-user">${text}</div>`;
        dailyChatInput.value = '';
    }

    try {
        // FIX: ruta relativa, igual que en los otros dos flujos.
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: 'daily_coach' })
        });

        const data = await response.json();

        if (data.correction) showToast(data.correction.explanation, data.correction.correction);

        dailyChatHistory.innerHTML += `<div class="msg-actor"><strong>Coach:</strong> ${data.coachResponse}</div>`;
        dailySideUnit.innerText = data.unit ? `Unit ${data.unit}: ${data.theme}` : (data.theme || "General Practice");
        dailyChatHistory.scrollTop = dailyChatHistory.scrollHeight;

    } catch (e) {
        console.error(e);
    }
}

// Utilidad para notificaciones flotantes (compartida por Roleplay y Daily Coach)
function showToast(exp, corr) {
    const t = document.createElement('div');
    t.className = 'feedback-toast';
    t.innerHTML = `⚠️ ${exp}<br><i>Try: ${corr}</i>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
}