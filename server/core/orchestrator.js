const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Memoria temporal en caché (para no regenerar el escenario en cada turno)
let currentSession = {
    theme: "Open Conversation",
    systemDirective: "You are a friendly English conversation partner. Chat naturally with the user.",
    history: []
};

async function orchestrator(userMessage, studentLevel = "A2-B1") {
    // studentLevel es un parámetro opcional, con valor por defecto.
    // Hoy nadie lo pasa todavía (no existe learningBrain.js aún), pero el
    // prompt ya está listo para recibir el nivel REAL del alumno en cuanto
    // exista esa pieza — sin tener que tocar este archivo de nuevo.

    // 1. DETECCIÓN DE NUEVO ESCENARIO
    if (userMessage.startsWith("I want to practice:")) {
        const topic = userMessage.replace("I want to practice:", "").trim();

        // REESCRITO: el diseño de la escena ahora parte de una situación
        // humana real, no de un objetivo gramatical a "forzar".
        const builderPrompt = `
        You are an Instructional Designer trained in Stephen Krashen's Natural Approach.
        The student wants to explore this real-life context: "${topic}".

        YOUR TASK: Design a real, human COMMUNICATIVE SITUATION where this context would
        naturally come up — NOT a grammar drill disguised as a scenario.

        NON-NEGOTIABLE RULES (Natural Approach):

        1. ACQUISITION OVER LEARNING: Do NOT design the scene around "making the student
           practice a grammar point." Design it around a real situation with a human need,
           goal, or problem. Whatever grammar/vocabulary fits "${topic}" should emerge
           naturally BECAUSE the situation calls for it — never because the actor is
           instructed to force it.
           Example: instead of "force the student to use Present Perfect," design
           "an old friend catching up after months apart, genuinely curious about their
           life" — Present Perfect shows up on its own, unprompted.

        2. COMPREHENSIBLE INPUT (i+1): assume the student's level is approximately
           ${studentLevel}. The actor's language should stay mostly within that level,
           introducing only slightly more complexity than expected. Never a steep jump
           in difficulty, never oversimplified either.

        3. LOW AFFECTIVE FILTER: the actor must be warm, patient, and genuinely curious —
           even while staying in character. This is a conversation to feel safe in, not
           a test. The actor should never sound like it's evaluating the student.

        4. CONTEXT-BASED, NOT GRAMMAR-BASED: ground everything in a concrete place,
           people, and goal. The situation itself should teach the vocabulary and
           structures — never introduce them as an explicit checklist.

        Return ONLY a JSON object with this exact structure:
        {
          "theme": "[A short 3-4 word title for the scenario, e.g., 'Catching Up With a Friend']",
          "systemDirective": "[Write the prompt for the AI actor. Tell it WHO it is, WHERE
          they are, and WHAT they genuinely want or need in this situation. The actor should
          lead the conversation through real curiosity and care about the student's answers —
          not by explicitly steering toward grammar. Rule: the AI must start the conversation,
          in character, with a natural opening line.]"
        }
        `;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "system", content: builderPrompt }],
                model: "llama-3.1-8b-instant",
                response_format: { type: "json_object" },
                temperature: 0.3
            });

            const newScenario = JSON.parse(completion.choices[0].message.content);

            currentSession = {
                theme: newScenario.theme,
                systemDirective: newScenario.systemDirective + " KEEP YOUR RESPONSES SHORT AND NATURAL. DO NOT BREAK CHARACTER. Stay warm and encouraging, never test-like.",
                history: []
            };

            return currentSession;

        } catch (error) {
            console.error("Error construyendo escenario:", error);
            return currentSession;
        }
    }

    // 2. MODO CONTINUO (Gamer / Live Coach)
    return currentSession;
}

function addTurnToHistory(userMessage, actorResponse) {
    currentSession.history.push({ role: "user", content: userMessage });
    currentSession.history.push({ role: "assistant", content: actorResponse });

    const MAX_MESSAGES = 20;
    if (currentSession.history.length > MAX_MESSAGES) {
        currentSession.history = currentSession.history.slice(-MAX_MESSAGES);
    }
}

module.exports = { orchestrator, addTurnToHistory };