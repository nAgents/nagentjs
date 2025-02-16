import { Registry } from "./src/core/Registry.js";
import { DebateManager } from "./src/core/DebateManager.js";
import { OllamaAPI } from "./src/core/OllamaAPI.js";

const registry = new Registry("agents");
await registry.loadAgents();
const ollama = new OllamaAPI();

export const ask = new Proxy({}, {
  get(_, agentName) {
    return async (prompt) => {
      const agent = registry.agents[agentName];
      if (!agent) throw new Error(`Agent '${agentName}' not found`);

      const context = `Agent Name: ${agent.name}\nDescription: ${agent.description}\n`
        + `Instruction: ${agent.instruction}\nKnowledge Files: ${agent.resources.join(", ")}`;

      const response = await ollama.generateResponse(prompt, context);
      console.log(`🤖 ${agent.name} responded: ${response}`);

      return response;
    };
  }
});

export const debate = async (prompt, config = {}, onUpdate = () => {}) => {
    const debateManager = new DebateManager(registry, config);
    return await debateManager.startDebate(prompt, onUpdate);
};