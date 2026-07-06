const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateRoleResponse(session, userMessage) {
    // 1. Detectar si es el inicio de un nuevo escenario
    const isInitiation = userMessage.startsWith("I want to practice:");
    
    let finalUserMessage = userMessage;
    let systemPrompt = `You are an English roleplay partner. ${session.systemDirective}`;

    // 2. Intervención Arquitectónica: Forzar el inicio de la escena
    if (isInitiation) {
        systemPrompt += `
        CRITICAL RULE: The user just entered the simulation. DO NOT acknowledge the prompt or say "Okay, let's practice". 
        IMMEDIATELY start the roleplay in character. 
        Your first message MUST be a natural greeting setting the scene, followed by an open-ended question that forces the user to respond using the target topic.
        `;
        finalUserMessage = "*Walks into the scene*"; 
    }

    // FIX: se construye el array de mensajes incluyendo el historial de la sesión.
    // Antes solo se mandaba { system, user_actual } — el modelo no tenía memoria
    // de los turnos anteriores, por eso repetía preguntas/saludos (el "loop").
    const messages = [
        { role: "system", content: systemPrompt },
        ...(session.history || []),
        { role: "user", content: finalUserMessage }
    ];

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
        });

        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("Error en la generación de rol:", error);
        return "I'm sorry, I'm having trouble staying in character right now. Let's keep practicing!";
    }
}

module.exports = { generateRoleResponse };