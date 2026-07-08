const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { interpretTopic } = require('./topicInterpreter.js');

// --- PROMPT DE RESPALDO (Por si falla la lógica de unidad) ---
const NATURAL_APPROACH_FALLBACK = `
You are a 'Natural Approach' Language Facilitator based on Stephen Krashen's theories. 
1. Goal: Provide 'Comprehensible Input' (i+1). 
2. Mirror Effect: If the student makes an error, don't correct them explicitly. Gently model the correct form in your reply.
3. Be warm, conversational, and focus on communication, not grammar drilling.
4. If you don't know the specific unit the student is studying, just have a natural, engaging conversation about their day.
`;

let dailyCoachSession = {
    unit: null,
    theme: "General Practice",
    systemDirective: NATURAL_APPROACH_FALLBACK, // Inicializado con respaldo
    history: []
};

function buildSystemDirective(unitData, rawInput) {
    if (unitData && unitData.found) {
        return `
You are a complementary English communication coach, working alongside a formal academy course.
The student studies grammar intensively (~5 hours/day). Do NOT repeat grammar theory.
Turn what they already studied into REAL, natural communication practice.

TODAY'S CONTENT (Interchange 2):
- Unit: ${unitData.unit}
- Theme: ${unitData.theme}
- Communicative goals: ${unitData.intentions}
- Grammar in focus: ${unitData.grammar}
- Suggested real-life scenario: ${unitData.scenario} (characters: ${unitData.characters})

FOLLOW THE NATURAL APPROACH (Krashen):
- Lead with communication and meaning.
- Ask contextualized questions that require natural use of the target grammar.
- Mirror Effect: If they make a mistake, acknowledge and model the correct form naturally.
- Keep the class conversational and warm.

Start the class now: greet briefly, reference what they studied, and immediately open with a contextual question.
        `;
    }

    return `
You are a friendly English Coach. The student is practicing freely.
FOLLOW THE NATURAL APPROACH (Krashen):
- Be supportive, low-stress, and conversational.
- Use the 'Mirror Effect' to correct grammar errors implicitly.
- Keep the conversation flowing with open-ended questions about the student's interests or day.
    `;
}

async function startDailyCoachSession(userInput) {
    const cleanInput = userInput.replace("Today I studied:", "").trim();
    const unitData = interpretTopic(cleanInput);

    dailyCoachSession = {
        unit: unitData.found ? unitData.unit : null,
        theme: unitData.found ? unitData.theme : cleanInput,
        systemDirective: buildSystemDirective(unitData, cleanInput),
        history: []
    };

    return dailyCoachSession;
}

async function generateDailyCoachResponse(session, userMessage, isInitiation) {
    const finalUserMessage = isInitiation ? "*Class begins*" : userMessage;

    // --- PROTECCIÓN CONTRA 400 BAD REQUEST ---
    // 1. Asegurar que haya un System Directive válido
    const systemContent = (session.systemDirective && session.systemDirective.trim().length > 0) 
                          ? session.systemDirective 
                          : NATURAL_APPROACH_FALLBACK;

    // 2. Construir mensajes sanitizados
    const messages = [
        { role: "system", content: systemContent },
        ...(session.history || []).map(m => ({ 
            role: m.role, 
            content: (m.content || "").toString().trim() 
        })),
        { role: "user", content: finalUserMessage.trim() }
    ];

    try {
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error en Daily Coach:", error.error || error);
        return "Sorry, I had trouble preparing today's class. Let's try again!";
    }
}

function addTurnToDailyCoachHistory(userMessage, coachResponse) {
    dailyCoachSession.history.push({ role: "user", content: userMessage });
    dailyCoachSession.history.push({ role: "assistant", content: coachResponse });

    const MAX_MESSAGES = 20;
    if (dailyCoachSession.history.length > MAX_MESSAGES) {
        dailyCoachSession.history = dailyCoachSession.history.slice(-MAX_MESSAGES);
    }
}

module.exports = {
    startDailyCoachSession,
    generateDailyCoachResponse,
    addTurnToDailyCoachHistory,
    getDailyCoachSession: () => dailyCoachSession
};