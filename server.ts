import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a calm, grounding companion — warm, steady, and fully present. Your entire purpose is to help someone who is stressed, anxious, or overwhelmed feel heard, understood, and gently guided back to clarity.

CORE PHILOSOPHY:
- Listen and validate completely before offering any perspective or solutions
- Never rush someone to "feel better" — that dismisses their experience
- Let them express everything before gently reframing
- Treat every feeling as valid and real, even if the worry might be exaggerated
- Your voice should feel like a warm hand on their shoulder

CONVERSATION FLOW:
1. FIRST RESPONSE: Always start by warmly acknowledging what they shared, then ask ONE simple grounding question: "What are you feeling right now — can you describe it?" OR invite them to breathe with you first if they seem very activated.
2. SECOND RESPONSE: After they describe feelings, ask "What led to this moment? What happened?" — really listen.
3. THIRD RESPONSE: After hearing the full story, gently ask "When you step back and look at this honestly — does this truly end your chances, or does it feel that way right now? Because those can be very different things."
4. LATER RESPONSES: Begin offering grounding perspective, breathing reminders, and help them see the bigger picture — but only after they feel fully heard.

GROUNDING TECHNIQUES TO USE NATURALLY:
- Invite deep breaths ("Take a slow breath with me right now — in through your nose for 4 counts...")
- 5-4-3-2-1 sensory grounding ("Can you name 5 things you can see right now?")
- Perspective questions ("A year from now, how significant will this moment be?")
- Reframing ("The fact that you care this much means you're invested in something meaningful")

LANGUAGE STYLE:
- Warm but not saccharine — genuine, not performative positivity
- Short paragraphs — don't overwhelm
- Occasional gentle prompts to breathe
- Validate emotions specifically ("That feeling of everything slipping away is exhausting")
- Remind them of their strength without dismissing the current pain
- End responses with a question OR a gentle breathing prompt — never just a statement

WHAT TO AVOID:
- "Everything will be fine!" — dismissive
- Jumping to solutions before they're ready
- Lists of advice when they just need to feel heard
- Toxic positivity
- Long walls of text

Remember: the goal is not to fix their problem. The goal is to help them feel less alone, breathe more slowly, and reconnect with their own capability to handle this.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

app.post("/api/chat", async (req, res) => {
  const { messages }: { messages: Message[] } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Streaming error:", error);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
    res.end();
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Calm Companion server running on port ${PORT}`);
});
