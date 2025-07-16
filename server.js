const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

let tokenjson = null;


async function tokengenrate() {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id',String(process.env.client_id));
  params.append('client_secret', String(process.env.client_secret));
  params.append('username', String(process.env.userna));
  params.append('password', String(process.env.password));
  try {
    const response = await axios.post('https://login.salesforce.com/services/oauth2/token', params);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 1* 60 * 60 * 1000); // 2 hours

    console.log("✅ Token retrieved successfully.");

    return {
      token: response.data.access_token,
      instanceUrl: response.data.instance_url,
      expiresAt: expiresAt.getTime(),
    };
  } catch (error) {
    console.error("❌ Error getting token:", error.response?.data || error.message);
    throw error;
  }
}


const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});


app.post("/ask", async (req, res) => {
  try {
    // Ensure valid Salesforce token
    if (!tokenjson || tokenjson.expiresAt < Date.now()) {
      console.log("🔄 Refreshing Salesforce token...");
      tokenjson = await tokengenrate();
    }

    console.log("🔐 Token:", tokenjson.token);

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

and also tell that lead is qualified or Not qualified or Still Considerable based on the answers provided after the 5 questions or whenever you feel you have enough information to make a decision (Don't add this in your message, just mention at the end of message after full stop).
IF the lead does not answer a question, politely ask them to provide that information before proceeding.
and after conclusion of qualify or not, summarize the key points of the conversation in a concise manner and give summary in your response.

Avoid asking questions that have already been answered in the conversation. Use prior context to guide your next question.`
      },
      ...messageHistory
    ];

    const completion = await openai.chat.completions.create({
      model: "llama3-70b-8192",
      messages,
    });

    const reply = completion.choices[0].message;
    res.json({ reply });

  } catch (error) {
    console.error("🔥 /ask Error:", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
