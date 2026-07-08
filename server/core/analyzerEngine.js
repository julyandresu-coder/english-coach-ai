const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeSession(chatHistory) {
    if (!chatHistory || chatHistory.length < 3) {
        throw new Error("La conversación es muy corta para ser evaluada.");
    }

    const conversationText = chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n");

    const prompt = `
    You are an expert English Language Assessor.
    Read the following roleplay conversation between an ACTOR (AI) and a USER.
    Evaluate ONLY the USER's English proficiency based on this interaction.
    
    Return ONLY a JSON object with this exact structure:
    {
      "estimated_level": "A1/A2/B1/B2/C1",
      "fluency_score": 0-100,
      "common_errors": [
        {
          "error": "phrase used",
          "correction": "correct phrase",
          "explanation": "brief explanation in English"
        }
      ]
    }
    CONVERSATION:
    ${conversationText}
    `;

    const completion = await groq.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        temperature: 0.1
    });
    
    return JSON.parse(completion.choices[0].message.content);
}

module.exports = { analyzeSession };