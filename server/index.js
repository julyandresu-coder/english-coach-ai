require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { orchestrator, addTurnToHistory } = require('./core/orchestrator.js');
const { checkErrors } = require('./core/correctorEngine.js');
const { generateRoleResponse } = require('./core/llmCore.js');
const { analyzeSession } = require('./core/analyzerEngine.js'); // <-- IMPORTACIÓN DEL EVALUADOR

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

// Endpoint to fetch Interchange 2 units
app.get('/api/units', (req, res) => {
  try {
    const rawData = fs.readFileSync(path.join(__dirname, '../knowledge/interchange2.json'), 'utf8');
    res.json(JSON.parse(rawData));
  } catch (error) {
    console.error("Error reading units:", error);
    res.status(500).json({ error: "Failed to read units data" });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, mode, context } = req.body; 
    console.log("Received chat request:", { mode, messageLength: message?.length });
    
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
            checkErrors(message, "Roleplay scenario: " + (session.theme || "Open Conversation"))
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

// ==========================================
// NUEVA RUTA: EVALUACIÓN Y CIERRE DE SESIÓN
// ==========================================
app.post('/api/evaluate', async (req, res) => {
  try {
      const { chatHistory } = req.body;
      
      if (!chatHistory || chatHistory.length === 0) {
          return res.status(400).json({ error: "No chat history provided" });
      }

      // 1. La IA analiza la conversación completa
      const evaluation = await analyzeSession(chatHistory);

      // (Nota: En la Fase 3, aquí agregaremos el código para guardar 
      // este 'evaluation' en Supabase, una vez tengamos el Login listo)

      // 2. Enviamos el resultado estructurado al frontend
      return res.json(evaluation);

  } catch (error) {
      console.error("Error en la evaluación:", error);
      res.status(500).json({ error: "Error procesando el feedback" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🤖 English Coach AI corriendo en puerto ${PORT}`));