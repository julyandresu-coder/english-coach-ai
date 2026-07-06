// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE (FRONTEND)
// ==========================================
// REEMPLAZA ESTAS DOS LÍNEAS CON TUS DATOS REALES DE SUPABASE
const SUPABASE_URL = 'TU_URL_AQUI';
const SUPABASE_ANON_KEY = 'TU_LLAVE_PUBLICA_AQUI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO GLOBAL ---
let chatHistory = []; 
let currentTopic = ""; 
let currentUser = null; 

// --- REFERENCIAS DOM ---
const viewAuth = document.getElementById('view-auth');
const viewHome = document.getElementById('view-home');
const viewChat = document.getElementById('view-chat');
const viewLive = document.getElementById('view-live');
const modal = document.getElementById('feedback-modal');

const btnHome = document.getElementById('btn-home');
const btnNavLive = document.getElementById('btn-nav-live');
const btnLogout = document.getElementById('btn-logout');
const userEmailDisplay = document.getElementById('user-email-display');

// ==========================================
// 2. SISTEMA DE NAVEGACIÓN Y AUTENTICACIÓN
// ==========================================
function showView(view) {
    viewAuth.classList.add('hidden');
    viewHome.classList.add('hidden');
    viewChat.classList.add('hidden');
    viewLive.classList.add('hidden');
    view.classList.remove('hidden');
    
    const isLoggedIn = !!currentUser;
    btnHome.classList.toggle('hidden', !isLoggedIn || view === viewHome);
    btnNavLive.classList.toggle('hidden', !isLoggedIn);
    btnLogout.classList.toggle('hidden', !isLoggedIn);
}

// Escuchar cambios en la sesión usando supabaseClient
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        currentUser = session.user;
        userEmailDisplay.innerText = currentUser.email;
        showView(viewHome);
    } else {
        currentUser = null;
        userEmailDisplay.innerText = "";
        showView(viewAuth);
    }
});

// Botones de Autenticación
const emailInput = document.getElementById('auth-email');
const passInput = document.getElementById('auth-password');
const authMsg = document.getElementById('auth-message');

document.getElementById('btn-register').addEventListener('click', async () => {
    authMsg.innerText = "Registrando...";
    const { error } = await supabaseClient.auth.signUp({ email: emailInput.value, password: passInput.value });
    authMsg.innerText = error ? `Error: ${error.message}` : "¡Registro exitoso! Revisa tu correo o inicia sesión.";
});

document.getElementById('btn-login').addEventListener('click', async () => {
    authMsg.innerText = "Ingresando...";
    const { error } = await supabaseClient.auth.signInWithPassword({ email: emailInput.value, password: passInput.value });
    if (error) authMsg.innerText = `Error: ${error.message}`;
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

btnHome.addEventListener('click', () => showView(viewHome));
btnNavLive.addEventListener('click', () => showView(viewLive));

// ==========================================
// 3. FLUJO 1: ROLEPLAY
// ==========================================
const homeInput = document.getElementById('home-input');
const chatDiv = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');

document.getElementById('btn-start-exp').addEventListener('click', () => {
    currentTopic = homeInput.value.trim();
    if (currentTopic) {
        showView(viewChat);
        chatDiv.innerHTML = ''; 
        chatHistory = [];
        sendChatMessage(`I want to practice: ${currentTopic}`, true);
    }
});

document.getElementById('btn-send-chat').addEventListener('click', () => sendChatMessage(chatInput.value));
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(chatInput.value); });

async function sendChatMessage(text, isInit = false) {
    if (!text.trim()) return;
    
    if (!isInit) {
        chatDiv.innerHTML += `<div class="msg-user">${text}</div>`;
        chatInput.value = '';
    }

    chatHistory.push({ role: 'user', content: text });

    try {
        const response = await fetch('/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: 'daily_coach' })
        });
        
        const data = await response.json();
        
        if (data.correction) showToast(data.correction.explanation, data.correction.correction);
        
        const iaResponse = data.coachResponse || data.actorResponse;
        chatDiv.innerHTML += `<div class="msg-actor"><strong>Coach:</strong> ${iaResponse}</div>`;
        document.getElementById('side-focus').innerText = data.theme || currentTopic;
        chatDiv.scrollTop = chatDiv.scrollHeight;

        chatHistory.push({ role: 'actor', content: iaResponse });

    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// 4. FLUJO 2: EVALUAR Y GUARDAR
// ==========================================
document.getElementById('btn-end-session').addEventListener('click', async () => {
    if (chatHistory.length < 3) {
        alert("¡La conversación es muy corta para evaluarla! Habla un poco más.");
        return;
    }

    modal.classList.remove('hidden');
    document.getElementById('modal-content').innerHTML = `<div style="text-align: center; color: #9ca3af; padding: 20px;"><h3>Procesando...</h3></div>`;

    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatHistory: chatHistory })
        });
        
        const evalData = await response.json();

        // GUARDAR EN SUPABASE usando supabaseClient
        if (currentUser) {
            await supabaseClient.from('session_metrics').insert([{
                user_id: currentUser.id,
                topic: currentTopic,
                estimated_level: evalData.estimated_level,
                fluency_score: evalData.fluency_score,
                common_errors: evalData.common_errors
            }]);
        }

        let html = `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.5rem;">Nivel Estimado: <span style="color:#34d399">${evalData.estimated_level}</span></h3>
                <h4 style="margin: 5px 0 0 0; color: #cbd5e1;">Puntuación de Fluidez: ${evalData.fluency_score} / 100</h4>
            </div>
            <h4 style="margin-bottom: 10px; color: #f87171;">⚠️ Oportunidades de Mejora:</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
        `;
        
        evalData.common_errors.forEach(err => {
            html += `
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-left: 4px solid #f87171; border-radius: 5px;">
                    <p style="margin: 0 0 5px 0; color: #ff9999;">❌ <i>"${err.error}"</i></p>
                    <p style="margin: 0 0 5px 0; color: #34d399;">✅ <b>"${err.correction}"</b></p>
                    <p style="margin: 0; font-size: 0.9rem; color: #9ca3af;">💡 ${err.explanation}</p>
                </div>
            `;
        });
        html += `</div>`;
        document.getElementById('modal-content').innerHTML = html;

    } catch (e) {
        console.error(e);
        document.getElementById('modal-content').innerHTML = `<p style="color:red">Hubo un error procesando tus resultados.</p>`;
    }
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
    showView(viewHome);
});

// ==========================================
// 5. FLUJO 3: LIVE COACH
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
        const response = await fetch('/api/chat', { // NOTA: Ruta relativa para producción
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: 'live_coach', context: currentContext }) 
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
        correctionsBox.innerHTML = "<span style='color:red'>Error de conexión.</span>";
    }
}

// Utilidad para notificaciones flotantes
function showToast(exp, corr) {
    const t = document.createElement('div');
    t.className = 'feedback-toast';
    t.innerHTML = `⚠️ ${exp}<br><i>Try: ${corr}</i>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
}