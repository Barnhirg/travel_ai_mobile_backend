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

const weatherLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: { error: 'Weather request limit reached.' }
});

const eventsLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 15,
  message: { error: 'Event request limit reached.' }
});

const flightsLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Flight lookup limit reached.' }
});

const hotelsLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Hotel search limit reached.' }
});

const carsLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Car rental request limit reached.' }
});

const currencyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 25,
  message: { error: 'Currency API limit reached.' }
});

// 🚀 Initialize Server
const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

// 🔧 Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// 🔹 OpenAI Chat Route with memory
app.post('/ask', askLimiter, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
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
        messages
      })
    });

    const data = await response.json();
    res.json({ reply: data.choices?.[0]?.message?.content || 'No response.' });
  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

// 🧩 Placeholder Routes (add logic later)
app.get('/weather', weatherLimiter, (req, res) => res.json({ message: 'Weather endpoint active.' }));
app.get('/events', eventsLimiter, (req, res) => res.json({ message: 'Events endpoint active.' }));
app.get('/flights', flightsLimiter, (req, res) => res.json({ message: 'Flights endpoint active.' }));
app.get('/hotels', hotelsLimiter, (req, res) => res.json({ message: 'Hotels endpoint active.' }));
app.get('/cars', carsLimiter, (req, res) => res.json({ message: 'Car rentals endpoint active.' }));
app.get('/currency', currencyLimiter, (req, res) => res.json({ message: 'Currency endpoint active.' }));

// 🚦 Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on http://0.0.0.0:${PORT}`);
});
