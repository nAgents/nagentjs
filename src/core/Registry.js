import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { AgentCache } from "./AgentCache.js";
import { OllamaAPI } from "./OllamaAPI.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Registry {
  constructor(agentsPath = path.join(__dirname, "../../agents")) {
    this.agentsPath = agentsPath;
    this.agents = {};
    this.agentCache = new AgentCache(this);
    this.ollama = new OllamaAPI();
  }

  async loadAgents() {
    if (!fs.existsSync(this.agentsPath)) {
      console.warn(`⚠️ Agents directory not found: ${this.agentsPath}`);
      return;
    }

    const agentDirs = fs.readdirSync(this.agentsPath).filter((dir) => {
      return fs.statSync(path.join(this.agentsPath, dir)).isDirectory();
    });

    let cacheUpdated = false;

    for (const dir of agentDirs) {
      const configPath = path.join(this.agentsPath, dir, "index.js");

      if (fs.existsSync(configPath)) {
        const configURL = pathToFileURL(configPath).href;
        const { default: agentConfig } = await import(configURL);

        const resourcePath = path.join(this.agentsPath, dir, "resources");
        const resourceFiles = this.getResourceFiles(resourcePath);

        this.agents[dir] = {
          ...agentConfig,
          resources: resourceFiles,
          resourcePath,
        };

        if (!this.agentCache.cache[dir]) {
          cacheUpdated = true;
        }
      }
    }

    if (cacheUpdated) {
      await this.agentCache.refreshCache();
    }
  }

  getResourceFiles(resourcePath) {
    if (!fs.existsSync(resourcePath)) return [];
    return fs.readdirSync(resourcePath).map(file => file);
  }

  getResourceContent(agentName, fileName) {
    const agent = this.agents[agentName];
    if (!agent) throw new Error(`❌ Agent '${agentName}' not found.`);
    const filePath = path.join(agent.resourcePath, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Resource '${fileName}' not found for agent '${agentName}'.`);
    }

    return fs.readFileSync(filePath, "utf-8");
  }

  async ask(agentName, prompt, responseFormat) {
    const agent = this.agents[agentName];
    if (!agent) throw new Error(`❌ Agent '${agentName}' not found.`);

    let selectedResources = {};
    let needed_resources = [];

    // Step 1: Ask which resources are needed ONLY if the agent has resources
    if (agent.resources.length > 0) {
      const resourceQueryPrompt = `You are assisting the agent "${agent.name}".`
        + `\nHere is a user's question: "${prompt}"`
        + `\nAvailable resources: ${agent.resources.join(", ")}`
        + `\nWhich resources should be retrieved to answer the question?`
        + `\nReturn a JSON object with:`
        + `\n{ "needed_resources": ["filename1.txt", "filename2.pdf", ...] }`
        + `\nIf no resources are needed, return an empty array.`;

      let resourceResponse = await this.ollama.generateResponse(resourceQueryPrompt);
      needed_resources = resourceResponse.data?.needed_resources || [];
    }

    // Step 2: Retrieve only the necessary resource contents
    if (Array.isArray(needed_resources) && needed_resources.length > 0) {
      needed_resources.forEach((fileName) => {
        try {
          selectedResources[fileName] = this.getResourceContent(agentName, fileName);
        } catch (error) {
          console.warn(`⚠️ Could not load resource '${fileName}' for agent '${agentName}': ${error.message}`);
        }
      });
    }

    // Step 3: Ask the agent with the retrieved resource content and custom response format
    const finalQueryPrompt = `Agent Name: ${agent.name}`
      + `\nDescription: ${agent.description}`
      + `\nInstruction: ${agent.instruction}`
      + `\nQuestion: "${prompt}"`
      + `\n${agent.resources.length > 0 ? "You **must** use the following resources to answer this question. Do not assume lack of information if relevant data is present:" : "You do not have any additional resources, use your knowledge to answer."}`
      + `\n${Object.entries(selectedResources).map(([file, content]) => `\n- ${file}: ${content.substring(0, 300)}...`).join("\n")}`
      + `\nReturn a JSON object in the following format:`
      + `\n${responseFormat}`;

    return await this.ollama.generateResponse(finalQueryPrompt);
  }
}