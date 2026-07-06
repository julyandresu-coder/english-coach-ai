require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { orchestrator, addTurnToHistory } = require('./core/orchestrator.js');
const { checkErrors } = require('./core/correctorEngine.js');
const { generateRoleResponse } = require('./core/llmCore.js');

// Módulo de Daily Coach — todos sus exports se importan una sola vez, aquí arriba.
const {
    startDailyCoachSession,
    generateDailyCoachResponse,
    addTurnToDailyCoachHistory,
    getDailyCoachSession
} = require('./core/DailyCoachEngine.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, mode, context } = req.body; 
    
    if (!message) return res.status(400).json({ error: "No message provided" });

    // ==========================================
    // MODO 1: LIVE COACH
    // ==========================================
    if (mode === 'live_coach') {
        const correctionData = await checkErrors(message, context);
        return res.json({ 
            correction: correctionData.hasErrors ? correctionData : null 
        });
    }

    // ==========================================
    // MODO 2: ROLEPLAY
    // ==========================================
    if (mode === 'roleplay') {
        const session = await orchestrator(message);

        const [actorResponse, correctionData] = await Promise.all([
            generateRoleResponse(session, message),
            checkErrors(message, "Roleplay scenario: " + message)
        ]);

        addTurnToHistory(message, actorResponse);

        return res.json({
            actorResponse: actorResponse,
            correction: correctionData.hasErrors ? correctionData : null,
            theme: session.theme || 'Open Conversation'
        });
    }

    // ==========================================
    // MODO 3: DAILY COACH
    // ==========================================
    if (mode === 'daily_coach') {
        const isInitiation = message.startsWith("Today I studied:");

        // FIX: ya no hay import() dinámico. getDailyCoachSession()
        // viene del mismo require de arriba, así que es la MISMA
        // instancia de módulo que usa startDailyCoachSession.
        const session = isInitiation
            ? await startDailyCoachSession(message)
            : getDailyCoachSession();

        const [coachResponse, correctionData] = await Promise.all([
            generateDailyCoachResponse(session, message, isInitiation),
            checkErrors(message, "Daily Coach practice: " + (session.theme || ""))
        ]);

        addTurnToDailyCoachHistory(message, coachResponse);

        return res.json({
            coachResponse: coachResponse,
            correction: correctionData.hasErrors ? correctionData : null,
            unit: session.unit,
            theme: session.theme
        });
    }

    return res.status(400).json({
        error: "Unknown or missing mode. Expected 'live_coach', 'roleplay', or 'daily_coach'."
    });

  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "System error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🤖 English Coach AI corriendo en puerto ${PORT}`));