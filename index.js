import { Registry } from "./src/core/Registry.js";

const registry = new Registry("agents");
await registry.loadAgents();

const response = await registry.ask("TestAgent", "Bonjour !");
console.log(response);