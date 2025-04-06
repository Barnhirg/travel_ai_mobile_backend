// server.mjs (Final Clean Version)

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOptions = {
  origin: [
    'https://travel-agent-ai-planner.netlify.app', // Netlify frontend
    'http://localhost:3000' // Local dev
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Rate Limiters
const limiter = (max, msg) => rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hrs
  max,
  message: { error: msg },
});

const askLimiter = limiter(50, 'Daily chat limit reached.');
const weatherLimiter = limiter(20, 'Weather request limit reached.');
const eventsLimiter = limiter(15, 'Event request limit reached.');
const flightsLimiter = limiter(10, 'Flight lookup limit reached.');
const hotelsLimiter = limiter(10, 'Hotel search limit reached.');
const carsLimiter = limiter(10, 'Car rental request limit reached.');
const currencyLimiter = limiter(25, 'Currency API limit reached.');

// 🧠 OpenAI Chat Route
app.post('/ask', askLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    res.json({ reply: data.choices[0]?.message?.content?.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to OpenAI.' });
  }
});

// 🌦 OpenWeather Route
app.get('/weather', weatherLimiter, async (req, res) => {
  const city = req.query.city;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Weather lookup failed.' });
  }
});

// 🎫 Ticketmaster Events
app.get('/events', eventsLimiter, async (req, res) => {
  const city = req.query.city;
  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${city}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Event search failed.' });
  }
});

// ✈️ Flights (Aviationstack)
app.get('/flights', flightsLimiter, async (req, res) => {
  const { dep_iata, arr_iata } = req.query;
  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${process.env.Aviationstack_API_KEY}&dep_iata=${dep_iata}&arr_iata=${arr_iata}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Flight lookup failed.' });
  }
});

// 🏨 Hotels (Amadeus)
app.get('/hotels', hotelsLimiter, async (req, res) => {
  const { lat, lon } = req.query;
  try {
    // Get access token
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.Amadeus_API_KEY,
        client_secret: process.env.Amadeus_API_SECRET
      }),
    });
    const { access_token } = await tokenRes.json();

    // Get hotels
    const hotelRes = await fetch(`https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-geocode?latitude=${lat}&longitude=${lon}&radius=10`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const hotelData = await hotelRes.json();
    res.json(hotelData);
  } catch (err) {
    res.status(500).json({ error: 'Hotel search failed.' });
  }
});

// 🚗 Car Rentals (Amadeus)
app.get('/cars', carsLimiter, async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.Amadeus_API_KEY,
        client_secret: process.env.Amadeus_API_SECRET
      }),
    });
    const { access_token } = await tokenRes.json();

    const carRes = await fetch(`https://test.api.amadeus.com/v1/shopping/availability/car-rental?latitude=${lat}&longitude=${lon}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const carData = await carRes.json();
    res.json(carData);
  } catch (err) {
    res.status(500).json({ error: 'Car rental search failed.' });
  }
});

// 💱 Currency Exchange
app.get('/currency', currencyLimiter, async (req, res) => {
  try {
    const url = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Currency lookup failed.' });
  }
});

// ✅ Health Check
app.get('/', (req, res) => {
  res.send('Travel Planner AI backend is running.');
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
