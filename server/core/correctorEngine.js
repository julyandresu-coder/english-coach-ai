const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function checkErrors(userText, context = "General casual conversation") {
    // Ignorar audios muy cortos (ruido de fondo, suspiros, etc.)
    if (!userText || userText.trim().split(' ').length < 2) {
        return { hasErrors: false };
    }

    const prompt = `
    You are a strict and expert English Fluency Coach for Spanish speakers.
    The user is speaking into a microphone. The input is a raw Speech-to-Text transcript.

    CURRENT USER CONTEXT / SITUATION: "${context}"

    YOUR MISSION:
    Evaluate if the sentence MAKES SENSE and sounds NATURAL specifically within the CURRENT CONTEXT provided above. 
    - If the context is a video game (e.g., Valorant, Call of Duty), gaming slang and terminology (like "push mid", "plant", "one HP", "he's low") are perfectly correct and natural. Do NOT correct them.
    - Be extremely strict regarding literal translations from Spanish (Spanglish) or loose words without structure.

    RESPONSE RULES:
    1. If the sentence sounds natural and native for this specific context, return ONLY: {"hasErrors": false}
    2. If it sounds forced, makes no sense, or is a bad literal translation, return ONLY a JSON with this exact structure:
    {
      "hasErrors": true,
      "correction": "[Exact, fluent way a native speaker would say this in the given context]",
      "explanation": "[In ENGLISH: Briefly explain why it sounds weird and teach the natural expression]"
    }

    Do NOT include markdown formatting. Return ONLY the raw JSON object.
    User input to evaluate: "${userText}"
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            temperature: 0.1 // Máxima precisión y rigor
        });
        
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.error("Error en correctorEngine:", e);
        return { hasErrors: false };
    }
}

module.exports = { checkErrors };