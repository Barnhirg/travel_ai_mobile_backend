// server.mjs
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

// Rate Limiting
const askLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hrs
  max: 50,
  message: { error: 'Daily chat limit reached.' }
});

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Middleware
const corsOptions = {
  origin: [
    'https://travel-agent-ai-planner.netlify.app', // Production
    'http://localhost:3000' // Dev
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Root Route
app.get('/', (req, res) => {
  res.send('Travel AI Backend is running.');
});

// Chat Route
app.post('/ask', askLimiter, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid message history.' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages
      })
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok || !data.choices?.[0]?.message?.content) {
      console.error('OpenAI error:', data);
      return res.status(500).json({ error: 'AI response error.' });
    }

    res.json({ reply: data.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Request failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
