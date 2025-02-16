import fs from "fs";
import path from "path";
import { OllamaAPI } from "./OllamaAPI.js";

const CACHE_DIR = path.resolve("cache");
const CACHE_PATH = path.join(CACHE_DIR, "agent_descriptions.json");

export class AgentCache {
  constructor(registry) {
    this.registry = registry;
    this.ollama = new OllamaAPI();
    this.cache = {};
    this.ensureCacheDirectory();
    this.loadCache();
  }

  ensureCacheDirectory() {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      console.log("✅ Created 'cache/' directory.");
    }
  }

  loadCache() {
    if (fs.existsSync(CACHE_PATH)) {
      try {
        this.cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
        console.log("✅ Loaded agent descriptions from cache.");
      } catch (err) {
        console.error("⚠️ Error loading cache:", err);
        this.cache = {};
      }
    }
  }

  async generateDescription(agentName, agentInstance) {
    console.log(`🛠️ Generating description for ${agentName}...`);
    const prompt = `Describe this agent briefly:\n\n`
      + `Agent Name: ${agentName}\n`
      + `Capabilities: ${agentInstance.description}\n`
      + `What is this agent specialized in?`;
    
    let response = await this.ollama.generateResponse(prompt);

    // Remove <think>...</think> and keep only the relevant part
    response = response.includes("</think>")
      ? response.split("</think>")[1].trim()
      : response.trim();

    console.log(`🤖 ${agentName} description: ${response}`);

    return response;
  }

  async refreshCache() {
    console.log("🔄 Generating agent descriptions...");
    const updatedCache = {};

    for (const [agentName, agentInstance] of Object.entries(this.registry.agents)) {
      updatedCache[agentName] = await this.generateDescription(agentName, agentInstance);
    }

    this.cache = updatedCache;
    fs.writeFileSync(CACHE_PATH, JSON.stringify(updatedCache, null, 2));
    console.log("✅ Saved agent descriptions to cache.");
  }

  async getDescription(agentName) {
    if (!this.cache[agentName]) {
      console.log(`🛠️ Generating missing description for ${agentName}...`);
      this.cache[agentName] = await this.generateDescription(agentName, this.registry.agents[agentName]);
      fs.writeFileSync(CACHE_PATH, JSON.stringify(this.cache, null, 2));
    }
    return this.cache[agentName];
  }
}