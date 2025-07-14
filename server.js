const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// ✅ Groq config (use OpenAI SDK with Groq endpoint)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Put your Groq API key in .env as GROQ_API_KEY
  baseURL: "https://api.groq.com/openai/v1", // Pointing to Groq's OpenAI-compatible endpoint
});

// Test route
app.post("/ask", async (req, res) => {
  const { messages: messageHistory = [] } = req.body;

  const messages = [
    {
  role: "system",
  content: `You are an AI assistant working for Dev Pratap Singh, a Salesforce consultant.

Your job is to qualify sales leads for a CRM product through a brief, professional conversation. You do this by asking up to 5 short and specific questions, one at a time. Keep the tone professional, focused, and efficient — no greetings, fluff, or marketing language.

Ask questions to collect the following:
- What CRM or tool they currently use (if any)
- Number of team members who will use the CRM
- Their budget for a CRM solution
- How soon they are looking to make a decision
- Whether they are the final decision-maker

Once all 5 areas are covered, or the lead has given enough information, end with a message like:
"Thanks! I have all the info I need. Someone from our team will follow up with you shortly."

and also tell that lead is qualified or Not qualified or Still Considerable based on the answers provided after the 5 questions or whenever you feel you have enough information to make a decision(Dont add this is you message just mention in the end of message after full stop ).
IF the lead does not answer a question, politely ask them to provide that information before proceeding.
and after conclusion of qualify or not , summarize the key points of the conversation in a concise manner and give summary in your reponse.

Avoid asking questions that have already been answered in the conversation. Use prior context to guide your next question.`

}
,
    ...messageHistory
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "llama3-70b-8192", // ✅ Use Groq-supported model
      messages,
    });

    const reply = completion.choices[0].message;
    res.json({ reply });
  } catch (error) {
    if (error.response) {
      console.error("Groq API error:", error.response.status, error.response.data);
      res.status(500).json({ error: error.response.data });
    } else {
      console.error("Client error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
