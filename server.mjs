import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = 3000;

// Global Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// 🌟 Rate Limiter for OpenAI (Sensitive API)
const openaiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // max 5 requests per minute
  message: 'Too many OpenAI requests. Please try again later.',
});

// 🌟 General fallback limiter (for future APIs if needed)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // allow 30 requests per minute otherwise
});

// 🔹 POST /ask Route
app.post('/ask', openaiLimiter, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid or missing message history.' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(500).json({ error: 'No valid AI response.' });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error('OpenAI API error:', err);
    res.status(500).json({ error: 'Failed to connect to AI service.' });
  }
});

// 🛡️ Apply fallback generalLimiter to anything else in the future
app.use(generalLimiter);

// Server Start
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
});
