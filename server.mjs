// server.mjs — Clean & complete backend with history, multiple APIs, rate limiting, and inline docs

// ----------------------------------------
// 📦 IMPORT DEPENDENCIES
// ----------------------------------------
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// ----------------------------------------
// 🔐 LOAD ENVIRONMENT VARIABLES
// ----------------------------------------
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------
// 🌐 CORS CONFIGURATION
// ----------------------------------------
const corsOptions = {
  origin: [
    'https://travel-agent-ai-planner.netlify.app', // ✅ Production frontend
    'http://localhost:3000'                         // ✅ Local dev
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// ----------------------------------------
// 🚦 RATE LIMITERS (per route)
// ----------------------------------------
const createLimiter = (max, msg) =>
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hrs
    max,
    message: { error: msg },
    keyGenerator: req => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip
  });

const askLimiter = createLimiter(50, 'Daily chat limit reached.');
const weatherLimiter = createLimiter(200, 'Daily weather limit reached.');
const eventsLimiter = createLimiter(100, 'Event lookup limit reached.');
const flightsLimiter = createLimiter(50, 'Flight API limit reached.');
const hotelsLimiter = createLimiter(50, 'Hotel API limit reached.');
const currencyLimiter = createLimiter(500, 'Currency API limit reached.');

// ----------------------------------------
// 🤖 AI CHAT ENDPOINT (with message history)
// ----------------------------------------
app.post('/ask', askLimiter, async (req, res) => {
  try {
    const messages = req.body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid message history' });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await openaiRes.json();
    if (!data.choices?.[0]?.message?.content) {
      return res.status(500).json({ error: 'Invalid OpenAI response' });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error('[Chat Error]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------
// 🌦️ WEATHER ENDPOINT
// ----------------------------------------
app.get('/weather', weatherLimiter, async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City required' });

  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
    );
    const data = await weatherRes.json();
    res.json(data);
  } catch (err) {
    console.error('[Weather Error]', err);
    res.status(500).json({ error: 'Weather API error' });
  }
});

// ----------------------------------------
// 🎫 EVENTS ENDPOINT
// ----------------------------------------
app.get('/events', eventsLimiter, async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City required' });

  try {
    const eventsRes = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${encodeURIComponent(city)}`
    );
    const data = await eventsRes.json();
    res.json(data);
  } catch (err) {
    console.error('[Events Error]', err);
    res.status(500).json({ error: 'Event API error' });
  }
});

// ----------------------------------------
// ✈️ FLIGHTS ENDPOINT
// ----------------------------------------
app.get('/flights', flightsLimiter, async (req, res) => {
  const { origin, destination, date } = req.query;
  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing flight search parameters' });
  }

  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_API_KEY}&client_secret=${process.env.AMADEUS_API_SECRET}`
    });
    const { access_token } = await tokenRes.json();

    const flightsRes = await fetch(
      `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1&nonStop=true&max=5`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );
    const flightData = await flightsRes.json();
    res.json(flightData);
  } catch (err) {
    console.error('[Flights Error]', err);
    res.status(500).json({ error: 'Flight API error' });
  }
});

// ----------------------------------------
// 🏨 HOTELS ENDPOINT
// ----------------------------------------
app.get('/hotels', hotelsLimiter, async (req, res) => {
  const { cityCode } = req.query;
  if (!cityCode) return res.status(400).json({ error: 'City code required' });

  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_API_KEY}&client_secret=${process.env.AMADEUS_API_SECRET}`
    });
    const { access_token } = await tokenRes.json();

    const hotelsRes = await fetch(
      `https://test.api.amadeus.com/v2/shopping/hotel-offers?cityCode=${cityCode}`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );
    const hotelData = await hotelsRes.json();
    res.json(hotelData);
  } catch (err) {
    console.error('[Hotels Error]', err);
    res.status(500).json({ error: 'Hotel API error' });
  }
});

// ----------------------------------------
// 💱 CURRENCY CONVERSION ENDPOINT
// ----------------------------------------
app.get('/currency', currencyLimiter, async (req, res) => {
  try {
    const fxRes = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGERATE_API_KEY}/latest/USD`
    );
    const fxData = await fxRes.json();
    res.json(fxData);
  } catch (err) {
    console.error('[Currency Error]', err);
    res.status(500).json({ error: 'Currency API error' });
  }
});

// ----------------------------------------
// 🚀 START SERVER
// ----------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
