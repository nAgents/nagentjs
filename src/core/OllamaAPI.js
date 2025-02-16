import ollama from "ollama";

export class OllamaAPI {
  constructor() {
    this.model = "deepseek-r1"; // Ensuring deepseek-r1 is used
  }

  async generateResponse(prompt, context = "") {
    const response = await ollama.chat({
      model: this.model,
      messages: [{ role: "system", content: context }, { role: "user", content: prompt }],
    });

    const rawResponse = response.message.content;
    const cleanedMessage = this.cleanResponse(rawResponse);
    const extractedData = this.extractValidJSON(rawResponse);

    return {
      message: cleanedMessage,
      initialPrompt: prompt,
      response: rawResponse,
      data: extractedData || null,
    };
  }

  async suggestRelevantAgent(prompt, registry) {
    const agentDescriptions = await Promise.all(
      Object.keys(registry.agents).map(async (agentName) => {
        return `${agentName}: ${await registry.getAgentDescription(agentName)}`;
      })
    );

    const suggestionPrompt = `Here are the available agents with their expertise:\n\n`
      + `${agentDescriptions.join("\n")}\n\n`
      + `Based on the question: "${prompt}", which agent should respond first?`
      + ` Only return the agent's name.`;

    return this.generateResponse(suggestionPrompt);
  }

  async refineDebateSummary(responses) {
    const summaryPrompt = `Summarize the following debate and determine the best consensus:\n\n${responses.join("\n")}`;
    return this.generateResponse(summaryPrompt);
  }

  cleanResponse(responseText) {
    if (responseText.includes("</think>")) {
      responseText = responseText.split("</think>")[1].trim();
    }
    
    // Remove Markdown-style JSON formatting (e.g., ```json ... ```)
    responseText = responseText.replace(/^```json/, "").replace(/```$/, "").trim();
    
    return responseText;
  }

  extractValidJSON(responseText) {
    try {
      // Find the first `{` and last `}` to extract the JSON part
      const jsonStart = responseText.indexOf("{");
      const jsonEnd = responseText.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        return JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } else {
        throw new Error("No valid JSON found");
      }
    } catch (error) {
      return null;
    }
  }
}