// server.mjs — Final Polished Version

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: true }));
app.use(bodyParser.json());

// Rate Limiters
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 OpenAI requests per minute
  message: { error: 'Rate limit exceeded. Please wait and try again.' }
});

const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Weather API limit exceeded. Please wait.' }
});

const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Ticketmaster API limit exceeded. Please wait.' }
});

const flightsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Flights API limit exceeded. Please wait.' }
});

// API Routes

// 🔹 OpenAI Chat with History
app.post('/ask', aiLimiter, async (req, res) => {
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
        messages: messages
      })
    });

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from AI.');
    }

    res.json({ reply: data.choices[0].message.content.trim() });
  } catch (err) {
    console.error('AI Chat Error:', err.message);
    res.status(500).json({ error: 'Failed to get AI response.' });
  }
});

// 🔹 Weather API
app.get('/weather', weatherLimiter, async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter missing.' });
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API_KEY}&units=metric`;

    const response = await fetch(weatherUrl);
    const data = await response.json();

    if (data.cod !== 200) {
      throw new Error(data.message || 'Weather fetch failed.');
    }

    res.json(data);
  } catch (err) {
    console.error('Weather API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});

// 🔹 Ticketmaster Events API
app.get('/events', eventsLimiter, async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ error: 'City parameter missing.' });
    }

    const eventsUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${encodeURIComponent(city)}`;

    const response = await fetch(eventsUrl);
    const data = await response.json();

    if (!data._embedded || !data._embedded.events) {
      throw new Error('No events found.');
    }

    res.json(data._embedded.events);
  } catch (err) {
    console.error('Ticketmaster API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// 🔹 Flights API (Amadeus)
app.get('/flights', flightsLimiter, async (req, res) => {
  try {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      return res.status(400).json({ error: 'Missing flight parameters.' });
    }

    // Obtain Access Token
    const tokenResponse = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_API_KEY}&client_secret=${process.env.AMADEUS_API_SECRET}`
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to retrieve Amadeus token.');
    }

    const flightsUrl = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1`;

    const flightsResponse = await fetch(flightsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const flightsData = await flightsResponse.json();

    if (!flightsData.data) {
      throw new Error('No flights found.');
    }

    res.json(flightsData.data);
  } catch (err) {
    console.error('Flights API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch flights.' });
  }
});

// 🔹 Root Route
app.get('/', (req, res) => {
  res.send('🌍 Travel Planner AI Server Running!');
});

// 🔹 Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on http://0.0.0.0:${PORT}`);
});
