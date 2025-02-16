import { OllamaAPI } from "./OllamaAPI.js";

export class DebateManager {
  constructor(registry, config = {}) {
    this.registry = registry;
    this.ollama = new OllamaAPI();
    this.config = {
      rounds: config.rounds || 3,
      consensus: config.consensus || 2,
      agents: config.agents || Object.keys(registry.agents),
    };
  }

  async startDebate(prompt, onUpdate) {
    console.log(`🎙️ Starting debate: "${prompt}"`);
    onUpdate({ type: "start", prompt });

    let opinions = {};
    let agreementCount = {}; 
    let pendingQuestions = []; 

    const presenterResponseFormat = `{
      "first_agent": "AgentName",
      "structured_prompt": "Best way to ask the question to the agent."
    }`;

    const presenterPrompt = `You are the debate moderator. Your mission is to find the best answer to a human's request using agents: ${this.config.agents.join(", ")}.
    \nThe human has asked: "${prompt}"
    \nYou should critically analyze responses and ensure coherence. If no agent can provide an answer, you may say so.
    \nWho should answer first, and how should they be asked?
    \nReturn ONLY the following JSON structure, with nothing else:
    \n${presenterResponseFormat}`;

    let presenterResponse = await this.ollama.generateResponse(presenterPrompt);
    if (typeof presenterResponse === "string") {
      presenterResponse = this.extractValidJSON(presenterResponse);
    }

    if (presenterResponse.error) {
      console.warn("⚠️ Error extracting JSON from Presenter:", presenterResponse.rawResponse);
      return;
    }

    const { first_agent, structured_prompt } = presenterResponse;
    console.log(`🤖 Presenter suggests starting with: ${first_agent}`);
    onUpdate({ type: "suggested_agent", agent: first_agent });

    const responseFormat = `{
      "has_response": true/false,
      "message": "Agent's response here.",
      "follow_up_request": { "target_agent": "AgentName", "question": "Optional follow-up question." } (optional)
    }`;

    let firstResponse = await this.registry.ask(first_agent, structured_prompt, responseFormat);
    if (typeof firstResponse === "string") {
      firstResponse = this.extractValidJSON(firstResponse);
    }

    if (firstResponse.error) {
      console.warn("⚠️ Error extracting JSON from first agent:", firstResponse.rawResponse);
      return;
    }

    opinions[first_agent] = firstResponse.message;
    console.log(`💬 ${first_agent}: ${firstResponse.message}`);
    onUpdate({ type: "message", agent: first_agent, response: firstResponse.message });

    for (let round = 1; round <= this.config.rounds; round++) {
      console.log(`🔄 Round ${round}...`);
      onUpdate({ type: "round", round });

      for (const agentName of this.config.agents) {
        if (agentName === first_agent) continue;

        let agentResponse = await this.registry.ask(agentName, structured_prompt, responseFormat);
        if (typeof agentResponse === "string") {
          agentResponse = this.extractValidJSON(agentResponse);
        }

        if (agentResponse.has_response) {
          opinions[agentName] = agentResponse.message;
          console.log(`💬 ${agentName}: ${agentResponse.message}`);
          onUpdate({ type: "message", agent: agentName, response: agentResponse.message });

          if (!agreementCount[agentResponse.message]) {
            agreementCount[agentResponse.message] = 0;
          }
          agreementCount[agentResponse.message]++;

          if (agreementCount[agentResponse.message] >= this.config.consensus) {
            console.log(`✅ Consensus reached: "${agentResponse.message}"`);
            const finalResponse = await this.formatFinalResponse(prompt, agentResponse.message, opinions);
            onUpdate({ type: "consensus", result: finalResponse });
            return finalResponse;
          }
        }
      }
    }

    const refinedSummary = await this.ollama.refineDebateSummary(Object.values(opinions));
    console.log(`🔍 Ollama Refined Summary: ${refinedSummary}`);
    onUpdate({ type: "ollama_summary", summary: refinedSummary });

    return this.formatFinalResponse(prompt, refinedSummary, opinions);
  }

  async formatFinalResponse(prompt, conclusion, opinions) {
    const formattingPrompt = `Based on the following debate:
    \nPrompt: "${prompt}"
    \nAgent Responses:
    ${Object.entries(opinions).map(([agent, response]) => `${agent}: ${response}`).join("\n")}
    \nFinal agreed-upon conclusion: "${conclusion}"
    \nFormat this conclusion in a clear, structured way based on the original prompt.`;

    return await this.ollama.generateResponse(formattingPrompt);
  }

  extractValidJSON(responseText) {
    try {
      const jsonStart = responseText.indexOf("{");
      const jsonEnd = responseText.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("No valid JSON found");
      }
    } catch (error) {
      return { error: "Invalid JSON format received", rawResponse: responseText };
    }
  }
}
