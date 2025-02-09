import { Agent } from "../../src/core/Agent.js";

export default class TestAgent extends Agent {
  constructor() {
    super("TestAgent");
  }

  async respond(prompt) {
    return `TestAgent a reçu: ${prompt}`;
  }
}