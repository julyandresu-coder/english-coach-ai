// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE (FRONTEND)
// ==========================================
const SUPABASE_URL = 'https://crvozlqlysmmgtfjueug.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4R08nzHsEtTcqMBOTy5zfQ_uUH2fysK';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ESTADO GLOBAL ---
let chatHistory = []; 
let currentTopic = ""; 
let currentUser = null; 
let selectedUnit = null;
let unitsData = {};
let sessionTimer = null;
let secondsRemaining = 0;
let practiceMode = "roleplay"; // 'roleplay' (Free Practice) or 'daily_coach' (Book Practice)

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

// Landing Home Referencias
const homeInput = document.getElementById('home-input');
const freePracticeDuration = document.getElementById('free-practice-duration');
const bookPracticeDuration = document.getElementById('book-practice-duration');
const btnStartFree = document.getElementById('btn-start-free');
const btnStartBook = document.getElementById('btn-start-book');
const unitsListContainer = document.getElementById('units-list-container');
const selectedUnitDetails = document.getElementById('selected-unit-details');
const selectedUnitTitle = document.getElementById('selected-unit-title');
const selectedUnitIntentions = document.getElementById('selected-unit-intentions');
const selectedUnitGrammar = document.getElementById('selected-unit-grammar');

// Chat Referencias
const chatDiv = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const btnEndSession = document.getElementById('btn-end-session');
const chatModeBadge = document.getElementById('chat-mode-badge');
const chatUnitBadge = document.getElementById('chat-unit-badge');
const timerCountdown = document.getElementById('timer-countdown');

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

    // Si salimos de la vista de chat, asegurémonos de limpiar el temporizador
    if (view !== viewChat) {
        clearInterval(sessionTimer);
    }
}

// Escuchar cambios en la sesión usando supabaseClient
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        currentUser = session.user;
        userEmailDisplay.innerText = currentUser.email;
        showView(viewHome);
        fetchUnits(); // Cargar unidades una vez autenticado
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
    authMsg.innerText = "Registering...";
    const { error } = await supabaseClient.auth.signUp({ email: emailInput.value, password: passInput.value });
    authMsg.innerText = error ? `Error: ${error.message}` : "Registration successful! Please check your email or log in.";
});

document.getElementById('btn-login').addEventListener('click', async () => {
    authMsg.innerText = "Logging in...";
    const { error } = await supabaseClient.auth.signInWithPassword({ email: emailInput.value, password: passInput.value });
    if (error) authMsg.innerText = `Error: ${error.message}`;
});

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

btnHome.addEventListener('click', () => showView(viewHome));
btnNavLive.addEventListener('click', () => showView(viewLive));

// ==========================================
// 3. CARGAR UNIDADES DEL LIBRO (DAILY COACH)
// ==========================================
async function fetchUnits() {
    try {
        const response = await fetch('/api/units');
        const data = await response.json();
        unitsData = data.units || {};
        renderUnitsList();
    } catch (e) {
        console.error("Error loading Interchange 2 units:", e);
        unitsListContainer.innerHTML = `<div style="text-align: center; color: #f87171; padding: 15px;">Failed to load course units.</div>`;
    }
}

function renderUnitsList() {
    unitsListContainer.innerHTML = "";
    Object.keys(unitsData).forEach(key => {
        const unit = unitsData[key];
        const unitId = key.replace('unit_', '');
        
        const item = document.createElement('div');
        item.className = 'unit-item';
        item.innerHTML = `
            <div class="unit-item-title">Unit ${unitId}</div>
            <div class="unit-item-subtitle">${unit.theme}</div>
        `;
        
        item.addEventListener('click', () => {
            // Deseleccionar anteriores
            document.querySelectorAll('.unit-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            
            selectedUnit = {
                id: unitId,
                key: key,
                ...unit
            };
            
            // Mostrar detalles
            selectedUnitTitle.innerText = `Unit ${unitId}: ${unit.theme}`;
            selectedUnitIntentions.innerText = unit.communicative_intentions.join(", ");
            selectedUnitGrammar.innerText = unit.implicit_grammar_tools.join(", ");
            selectedUnitDetails.classList.remove('hidden');
            
            // Habilitar botón de inicio
            btnStartBook.disabled = false;
            btnStartBook.innerText = `Start Unit ${unitId} Practice ➔`;
        });
        
        unitsListContainer.appendChild(item);
    });
}

// ==========================================
// 4. TEMPORIZADOR DE SESIÓN (TIMER)
// ==========================================
function startSessionTimer(minutes) {
    clearInterval(sessionTimer);
    secondsRemaining = minutes * 60;
    
    // Habilitar controles de chat en caso de que estuvieran bloqueados
    chatInput.disabled = false;
    btnSendChat.disabled = false;
    chatInput.placeholder = "Respond in character...";
    
    updateTimerDisplay();
    
    sessionTimer = setInterval(() => {
        secondsRemaining--;
        updateTimerDisplay();
        
        if (secondsRemaining <= 0) {
            clearInterval(sessionTimer);
            handleTimeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    timerCountdown.innerText = formattedTime;
    
    // Alerta visual cuando queda poco tiempo (menos de 30 segundos)
    if (secondsRemaining < 30) {
        timerCountdown.style.color = '#ef4444';
        timerCountdown.style.animation = 'fadeIn 0.5s infinite alternate';
    } else {
        timerCountdown.style.color = '#f43f5e';
        timerCountdown.style.animation = 'none';
    }
}

async function handleTimeUp() {
    chatInput.disabled = true;
    btnSendChat.disabled = true;
    chatInput.placeholder = "Time is up! Generating feedback...";
    
    chatDiv.innerHTML += `<div class="msg-actor" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05);">
        <strong>System Notification:</strong> Your practice time has ended. Analyzing your results now...
    </div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;

    // Pequeño retardo para que el usuario lea la notificación y luego abre el modal
    setTimeout(() => {
        btnEndSession.click();
    }, 1500);
}

// ==========================================
// 5. INICIAR EXPERIENCIAS DE PRÁCTICA
// ==========================================

// Iniciar Free Practice (Roleplay Mode)
btnStartFree.addEventListener('click', () => {
    const topic = homeInput.value.trim() || "Casual talk about movies and food";
    currentTopic = topic;
    practiceMode = "roleplay";
    
    const minutes = parseInt(freePracticeDuration.value) || 5;
    
    // UI Setup
    showView(viewChat);
    chatDiv.innerHTML = ''; 
    chatHistory = [];
    
    chatModeBadge.innerText = "Roleplay Mode";
    chatModeBadge.style.borderColor = "var(--accent-blue)";
    chatModeBadge.style.background = "rgba(59, 130, 246, 0.2)";
    chatUnitBadge.classList.add('hidden');
    
    startSessionTimer(minutes);
    sendChatMessage(`I want to practice: ${topic}`, true);
});

// Iniciar Book Practice (Daily Coach Mode)
btnStartBook.addEventListener('click', () => {
    if (!selectedUnit) return;
    
    currentTopic = selectedUnit.theme;
    practiceMode = "daily_coach";
    
    const minutes = parseInt(bookPracticeDuration.value) || 5;
    
    // UI Setup
    showView(viewChat);
    chatDiv.innerHTML = ''; 
    chatHistory = [];
    
    chatModeBadge.innerText = "Daily Coach (Book)";
    chatModeBadge.style.borderColor = "#10b981";
    chatModeBadge.style.background = "rgba(16, 185, 129, 0.2)";
    chatUnitBadge.innerText = `Unit ${selectedUnit.id}`;
    chatUnitBadge.classList.remove('hidden');
    
    startSessionTimer(minutes);
    // Daily Coach inicia con "Today I studied: ..."
    sendChatMessage(`Today I studied: Unit ${selectedUnit.id} - ${selectedUnit.theme}`, true);
});

// Enviar mensajes en chat
btnSendChat.addEventListener('click', () => sendChatMessage(chatInput.value));
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(chatInput.value); });

async function sendChatMessage(text, isInit = false) {
    if (!text.trim()) return;
    
    if (!isInit) {
        chatDiv.innerHTML += `<div class="msg-user">${text}</div>`;
        chatInput.value = '';
    }

    chatHistory.push({ role: 'user', content: text });
    chatDiv.scrollTop = chatDiv.scrollHeight;

    try {
        const response = await fetch('/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: practiceMode })
        });
        
        const data = await response.json();
        
        if (data.correction) showToast(data.correction.explanation, data.correction.correction);
        
        const iaResponse = data.coachResponse || data.actorResponse;
        chatDiv.innerHTML += `<div class="msg-actor"><strong>${practiceMode === 'daily_coach' ? 'Coach' : 'Partner'}:</strong> ${iaResponse}</div>`;
        document.getElementById('side-focus').innerText = data.theme || currentTopic;
        chatDiv.scrollTop = chatDiv.scrollHeight;

        chatHistory.push({ role: 'actor', content: iaResponse });

    } catch (e) {
        console.error(e);
        chatDiv.innerHTML += `<div class="msg-actor" style="color: #ef4444;"><strong>Error:</strong> Failed to connect to server. Please try again.</div>`;
    }
}

// ==========================================
// 6. EVALUAR Y GUARDAR
// ==========================================
btnEndSession.addEventListener('click', async () => {
    // Parar temporizador
    clearInterval(sessionTimer);
    
    if (chatHistory.length < 3) {
        alert("The conversation is too short to evaluate! Please converse a bit more.");
        return;
    }

    modal.classList.remove('hidden');
    document.getElementById('modal-content').innerHTML = `
        <div style="text-align: center; color: #9ca3af; padding: 20px;">
            <div class="loader" style="border: 4px solid #1e293b; border-top: 4px solid var(--accent-blue); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            <h3>Analyzing conversation & generating feedback...</h3>
        </div>
    `;

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
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid var(--glass-border);">
                <h3 style="margin: 0; font-size: 1.5rem;">Estimated Level: <span style="color:#34d399">${evalData.estimated_level}</span></h3>
                <h4 style="margin: 5px 0 0 0; color: #cbd5e1; font-weight: 400;">Fluency Score: <strong>${evalData.fluency_score} / 100</strong></h4>
            </div>
            <h4 style="margin-bottom: 12px; color: #38bdf8; font-size: 1.1rem;">⚠️ Opportunities for Improvement:</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
        `;
        
        if (!evalData.common_errors || evalData.common_errors.length === 0) {
            html += `<p style="color: #34d399; font-style: italic;">✨ Excellent job! No major grammar or phrasing errors were found in this session.</p>`;
        } else {
            evalData.common_errors.forEach(err => {
                html += `
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; border-left: 4px solid #f87171; border-radius: 6px;">
                        <p style="margin: 0 0 5px 0; color: #f87171;">❌ <i>"${err.error}"</i></p>
                        <p style="margin: 0 0 8px 0; color: #34d399;">✅ <b>"${err.correction}"</b></p>
                        <p style="margin: 0; font-size: 0.9rem; color: #94a3b8; line-height: 1.4;">💡 ${err.explanation}</p>
                    </div>
                `;
            });
        }
        html += `</div>`;
        document.getElementById('modal-content').innerHTML = html;

    } catch (e) {
        console.error(e);
        document.getElementById('modal-content').innerHTML = `<p style="color:#ef4444; font-weight: 600;">There was an error processing your results. Please try again later.</p>`;
    }
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
    showView(viewHome);
});

// ==========================================
// 7. FLUJO 3: LIVE COACH
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
    btnListen.innerText = isListening ? "⏹ Stop Listening" : "🎤 Start Listening";
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
    correctionsBox.innerHTML = "<i>Analyzing grammar and context...</i>";
    const currentContext = document.getElementById('live-context')?.value || "General casual conversation";

    try {
        const response = await fetch('/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode: 'live_coach', context: currentContext }) 
        });
        
        const data = await response.json();
        if (data.correction) {
            correctionsBox.innerHTML = `
                <div style="color:#ff9999; margin-bottom: 8px;">⚠️ ${data.correction.explanation}</div>
                <div style="color:white; font-size:1.1rem;">Natural phrasing: <b>${data.correction.correction}</b></div>`;
        } else {
            correctionsBox.innerHTML = `<span style="color:#34d399">✨ Perfect for this context!</span>`;
            setTimeout(() => correctionsBox.innerHTML = "", 4000);
        }
    } catch (e) {
        console.error(e);
        correctionsBox.innerHTML = "<span style='color:#ef4444'>Connection error.</span>";
    }
}

// Utilidad para notificaciones flotantes (toasts)
function showToast(exp, corr) {
    // Si ya hay un toast, removerlo
    const activeToast = document.querySelector('.feedback-toast');
    if (activeToast) activeToast.remove();
    
    const t = document.createElement('div');
    t.className = 'feedback-toast';
    t.innerHTML = `⚠️ <strong>Correction Alert:</strong><br>${exp}<br><span style="color: #34d399; display: block; margin-top: 5px;">👉 <em>Try: "${corr}"</em></span>`;
    document.body.appendChild(t);
    setTimeout(() => {
        if (t.parentNode) t.remove();
    }, 7000);
}

// Estilos clave adicionales para animaciones en JS
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(styleSheet);