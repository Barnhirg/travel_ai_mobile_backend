// server.mjs
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

// 🔒 Rate Limiters
const askLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  message: { error: 'Daily chat limit reached.' }
});

// Initialize Express App
const app = express();
const PORT = 3000;

// 🔧 Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// 🔹 OpenAI Chat Route
app.post('/ask', askLimiter, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message history.' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response.';
    res.json({ reply });
  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

// 🔹 Placeholder Routes with Rate Limits
app.get('/weather', rateLimit({ windowMs: 86400000, max: 20 }), (req, res) =>
  res.json({ message: 'Weather endpoint active.' })
);
app.get('/events', rateLimit({ windowMs: 86400000, max: 15 }), (req, res) =>
  res.json({ message: 'Events endpoint active.' })
);
app.get('/flights', rateLimit({ windowMs: 86400000, max: 10 }), (req, res) =>
  res.json({ message: 'Flights endpoint active.' })
);
app.get('/hotels', rateLimit({ windowMs: 86400000, max: 10 }), (req, res) =>
  res.json({ message: 'Hotels endpoint active.' })
);
app.get('/cars', rateLimit({ windowMs: 86400000, max: 10 }), (req, res) =>
  res.json({ message: 'Car rentals endpoint active.' })
);
app.get('/currency', rateLimit({ windowMs: 86400000, max: 25 }), (req, res) =>
  res.json({ message: 'Currency endpoint active.' })
);

// 🔁 Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on http://0.0.0.0:${PORT}`);
});
