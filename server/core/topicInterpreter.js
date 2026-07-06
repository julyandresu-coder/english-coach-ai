const fs = require('fs');
const path = require('path');

// Ruta corregida: sube dos niveles (sale de core, sale de server) y entra a knowledge
const knowledgePath = path.join(__dirname, '../../knowledge/interchange2.json');

function interpretTopic(userMessage) {
    const rawData = fs.readFileSync(knowledgePath, 'utf8');
    const knowledgeBase = JSON.parse(rawData);
    const lowerMessage = userMessage.toLowerCase();

    let foundUnit = null;
    let unitId = "";

    // 1. Búsqueda Directa (ej. "Unit 2")
    const unitMatch = lowerMessage.match(/unit\s*(\d+)/);
    if (unitMatch) {
        unitId = unitMatch[1];
        foundUnit = knowledgeBase.units[`unit_${unitId}`];
    }

    // 2. Búsqueda Inversa (ej. "past simple", "childhood", "quantifiers")
    if (!foundUnit) {
        for (const [key, unit] of Object.entries(knowledgeBase.units)) {
            const matchesGrammar = unit.implicit_grammar_tools.some(grammar => {
                const cleanGrammar = grammar.split('(')[0].trim().toLowerCase();
                return lowerMessage.includes(cleanGrammar);
            });

            if (matchesGrammar) {
                foundUnit = unit;
                unitId = key.replace('unit_', '');
                break; 
            }
        }
    }

    // 3. Estructurar la sesión para el Learning Orchestrator
    if (foundUnit) {
        return {
            found: true,
            unit: unitId,
            theme: foundUnit.theme,
            intentions: foundUnit.communicative_intentions.join(", "),
            scenario: foundUnit.scenarios[0].context,
            characters: foundUnit.scenarios[0].characters.join(" and "),
            grammar: foundUnit.implicit_grammar_tools.join(", ")
        };
    }

    return { found: false };
}

module.exports = { interpretTopic };