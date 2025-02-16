import { WebSocketServer } from "ws";
import { debate } from "./ask.js";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("🔌 Client connecté");

  ws.on("message", async (message) => {
    const { prompt, config } = JSON.parse(message);
    
    console.log(`📨 Débat reçu : "${prompt}"`);
    
    await debate(prompt, config, (update) => {
      ws.send(JSON.stringify(update));
    });
  });

  ws.on("close", () => console.log("❌ Client déconnecté"));
});

console.log("🚀 WebSocket Server démarré sur ws://localhost:8080");