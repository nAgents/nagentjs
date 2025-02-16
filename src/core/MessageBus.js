export class MessageBus {
    constructor() {
      this.messages = [];
    }
  
    send(sender, recipient, message) {
      this.messages.push({ sender, recipient, message });
    }
  
    getMessagesFor(recipient) {
      return this.messages.filter(msg => msg.recipient === recipient);
    }
  }