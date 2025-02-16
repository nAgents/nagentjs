import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
  console.log("✅ Connecté au WebSocket !");
  
  // Envoi d'un débat test
  ws.send(JSON.stringify({
    prompt: "Quel temps fera-t-il dans 1h ?",
    config: { rounds: 3, consensus: 2, agents: ["Weathy", "Tecky", "Sage"] }
  }));
});

ws.on("message", (data) => {
  console.log("📩 Mise à jour du débat :", JSON.parse(data));
});

ws.on("close", () => {
  console.log("❌ Déconnecté du WebSocket");
});