const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
const axios = require("axios");
const twilio = require('twilio');


require("dotenv").config();

const accountSid = process.env.accountsid;
const authToken = process.env.auth_token;
const client = twilio(accountSid, authToken);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let tokenjson = null;


async function tokengenrate() {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', String(process.env.client_id));
  params.append('client_secret', String(process.env.client_secret));
  params.append('username', String(process.env.userna));
  params.append('password', String(process.env.password));
  try {
    const response = await axios.post('https://login.salesforce.com/services/oauth2/token', params);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 1 * 60 * 60 * 1000);

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

    if (tokenjson == null || tokenjson.expiresAt < Date.now()) {
      console.log("🔄 Refreshing Salesforce token...");
      tokenjson = await tokengenrate();
      console.log("✅ Token refreshed successfully.", tokenjson);
    }
    console.log('reqbdoy', req.body);


    let { messages: messageHistory = [] } = req.body;

    if (typeof messageHistory === 'string') {
  try {
    messageHistory = JSON.parse(messageHistory);
  } catch (err) {
    console.error("❌ Failed to parse 'messages' JSON:", err.message);
    return res.status(400).json({ error: "Invalid 'messages' format. Must be an array or valid JSON string." });
  }
}

    const messages = [
      {
       role: "system",
content: `You are an AI assistant working for Dev Pratap Singh, a Salesforce consultant.

Your job is to qualify sales leads for a CRM product through a brief, professional conversation. Ask up to 5 short, specific, and context-aware questions — one at a time. Keep your tone focused, professional, and efficient. Avoid greetings, marketing fluff, or repetitive questions.

Your objective is to gather the following details (one at a time, using prior context to avoid repeats):
1. What CRM (if any) they currently use
2. Number of team members who will use the CRM
3. Their budget for a CRM solution
4. How soon they are planning to decide
5. Whether they are the final decision-maker

Once all 5 areas are covered, or you have enough data, stop asking questions and reply with:
"Thanks! I have all the info I need. Someone from our team will follow up with you shortly."

Then, **return a JSON response** in the following format — on a new line:

{
  "status": "Qualified" | "Not Qualified" | "Still Considerable",
  "score": (number from 0–100),
  "summary": "A short bullet summary of key info given by the lead"
}

If a lead skips a question, politely ask them for that info before continuing. Do not repeat questions they’ve already answered. Do not include the JSON inside a code block.`

      },
      ...messageHistory
    ];
    console.log("Messages to OpenAI:", messages);

    const completion = await openai.chat.completions.create({
      model: "llama3-70b-8192",
      messages,
    });

    const reply = await completion.choices[0].message;
    client.messages
  .create({
     body:reply.content,
     from: 'whatsapp:+14155238886',
     to: 'whatsapp:+918306234339'
   })
  .then(message => console.log(message.body))
  .catch(error => console.error(error));

    messageHistory.push(reply);
    const messtoupdate = messageHistory;


      const reqbody = {
        "compositeRequest": [
          {
            "method": "GET",
            "url": "/services/data/v64.0/query?q=SELECT+Id,+FirstName,+LastName+FROM+Lead+WHERE+Phone='+"+req.body.phone+"'",
            "referenceId": "getLead"
          },
          {
            "method": "PATCH",
            "url": "/services/data/v64.0/sobjects/Lead/@{getLead.records[0].Id}",
            "referenceId": "updateLead",
            "body": {
              "messagehistory__c":  JSON.stringify(messtoupdate)
            }
          }
        ]
      }
    const response = await axios.post(
      `${tokenjson.instanceUrl}/services/data/v64.0/composite`,reqbody, {
        headers: {
          Authorization: `Bearer ${tokenjson.token}`,
          "Content-Type": "application/json"
        }} );

    console.log("✅ Salesforce response:", response.data);
    res.json({
      reply: reply.content,
      messageHistory: messtoupdate,
      status: "success",
      salesforceResponse: response.data
    });
    }


   catch (error) {
    console.error("🔥 /ask Error:", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});



app.post("/webhook", async(req, res) => {
  const remsg = req.body.Body;
  const phone = req.body.WaId;
  try{
       if (tokenjson == null || tokenjson.expiresAt < Date.now()) {
      console.log("🔄 Refreshing Salesforce token...");
      tokenjson = await tokengenrate();
      console.log("✅ Token refreshed successfully.", tokenjson);
    }
    console.log("Using token:", tokenjson.token)
    const getprevious = await axios.get(
      `${tokenjson.instanceUrl}/services/data/v64.0/query?q=SELECT+Id,+messagehistory__c+FROM+Lead+WHERE+Phone='${phone}'`, {
        headers: {
          Authorization: `Bearer ${tokenjson.token}`,
          "Content-Type": "application/json"
        } });
    console.log("Previous message history:", getprevious.data);
    const previousMessages =JSON.parse(getprevious.data.records[0].messagehistory__c);
    previousMessages.push({
      role: "user",
      content: remsg
    });
    const updatelead = await axios.patch(
      `${tokenjson.instanceUrl}/services/data/v64.0/sobjects/Lead/${getprevious.data.records[0].Id}`,
      {
        messagehistory__c: JSON.stringify(previousMessages)
      },
      {
        headers: {
          Authorization: `Bearer ${tokenjson.token}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("Updated lead with new message history:", updatelead.data);


  }catch(e){

  }
  res.status(200).send("Webhook received");
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
