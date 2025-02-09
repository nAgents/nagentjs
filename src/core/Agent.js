export class Agent {
    constructor(name) {
      this.name = name;
    }
  
    async respond(prompt) {
      throw new Error(`Agent ${this.name} n'a pas implémenté 'respond()'`);
    }
  }