const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { interpretTopic } = require('./topicInterpreter.js');

// Sesión independiente del Roleplay — no comparten historial.
let dailyCoachSession = {
    unit: null,
    theme: "General Practice",
    systemDirective: null,
    history: []
};

function buildSystemDirective(unitData, rawInput) {
    // CASO A: se reconoció la unidad/gramática en la base de conocimiento
    if (unitData.found) {
        return `
You are a complementary English communication coach, working alongside a formal academy course.
The student studies grammar intensively at their academy (~5 hours/day). Your job is NOT to repeat
grammar theory. Your job is to turn what they already studied into REAL, natural communication practice.

TODAY'S CONTENT (from Interchange 2, 5th Edition):
- Unit: ${unitData.unit}
- Theme: ${unitData.theme}
- Communicative goals: ${unitData.intentions}
- Grammar in focus (implicit, do NOT lecture about it): ${unitData.grammar}
- Suggested real-life scenario: ${unitData.scenario} (characters: ${unitData.characters})

FOLLOW THE NATURAL APPROACH (Krashen):
- Lead with communication and meaning, never with grammar explanations.
- Ask contextualized questions that require the student to naturally produce the target grammar/vocabulary.
- Mix in short, situational exercises and a light roleplay moment tied to the scenario above.
- If the student makes a mistake, don't interrupt the flow harshly — acknowledge their message, gently
  model the correct form in your reply, and briefly explain only if it's a recurring or meaningful error.
- Keep the class conversational, warm, and short per turn (this is chat, not an essay).
- Do NOT re-teach the grammar rule from scratch — assume the academy already did that today.

Start the class now: greet the student briefly, reference what they studied today in one sentence,
and immediately open with a real, contextual question or micro-scenario that gets them talking.
        `;
    }

    // CASO B: el alumno escribió algo libre que no coincidió con ninguna unidad
    return `
You are a complementary English communication coach, working alongside a formal academy course.
The student just told you, in their own words, what they studied today: "${rawInput}".
You don't have structured data for this, so infer the grammar/vocabulary focus directly from their message.

FOLLOW THE NATURAL APPROACH (Krashen):
- Lead with communication and meaning, never grammar explanations.
- Ask contextualized questions that require them to naturally use what they mention they studied.
- Include a short situational exercise or light roleplay moment.
- Correct errors gently, in-flow, without breaking the conversation.
- Keep turns short and conversational.

Start the class now: greet briefly, reference what they said they studied, and open with a real question.
    `;
}

async function startDailyCoachSession(userInput) {
    // El input esperado desde el frontend: "Today I studied: Unit 5" o "Today I studied: Present Perfect"
    const cleanInput = userInput.replace("Today I studied:", "").trim();

    // Búsqueda LOCAL, sin LLM — igual que pide el spec: nunca gastar API para "buscar unidades".
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

    const messages = [
        { role: "system", content: session.systemDirective },
        ...(session.history || []),
        { role: "user", content: finalUserMessage }
    ];

    try {
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error en Daily Coach:", error);
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
