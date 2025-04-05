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
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
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
const PORT = 3000;

// 🔧 Middleware
const corsOptions = {
  origin: '*', // use your Netlify URL here in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept'],
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// 🔹 OpenAI Chat Route
app.post('/ask', askLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await response.json();
    res.json({ reply: data.choices?.[0]?.message?.content || 'No response.' });
  } catch (err) {
    console.error('OpenAI Error:', err);
    res.status(500).json({ error: 'Failed to generate AI response.' });
  }
});

// 🔹 Weather Route
app.get('/weather', weatherLimiter, async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City is required.' });

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ success: true, weather: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});

// 🔹 Events Route
app.get('/events', eventsLimiter, async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City is required.' });

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${encodeURIComponent(city)}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json({ success: true, events: data._embedded?.events || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// 🔹 Flights Route
app.get('/flights', flightsLimiter, async (req, res) => {
  const { origin, destination, date } = req.query;
  if (!origin || !destination || !date) return res.status(400).json({ error: 'Missing flight parameters.' });

  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    const flightRes = await fetch(`https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const flightData = await flightRes.json();
    res.json({ success: true, flights: flightData.data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch flight data.' });
  }
});

// 🔹 Hotels Route
app.get('/hotels', hotelsLimiter, async (req, res) => {
  const { cityCode } = req.query;
  if (!cityCode) return res.status(400).json({ error: 'City code is required.' });

  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    const hotelRes = await fetch(`https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const hotelData = await hotelRes.json();
    res.json({ success: true, hotels: hotelData.data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hotel data.' });
  }
});

// 🔹 Cars Route
app.get('/cars', carsLimiter, async (req, res) => {
  const { cityCode, startDate, endDate } = req.query;
  if (!cityCode || !startDate || !endDate) return res.status(400).json({ error: 'Missing car rental parameters.' });

  try {
    const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    const carRes = await fetch(`https://test.api.amadeus.com/v1/shopping/availability/car-rental-offers?pickupLocation=${cityCode}&pickupDate=${startDate}&returnDate=${endDate}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const carData = await carRes.json();
    res.json({ success: true, cars: carData.data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch car rental data.' });
  }
});

// 🔹 Currency Route (placeholder)
app.get('/currency', currencyLimiter, (req, res) => {
  res.json({ message: 'Currency endpoint active.' });
});

// 🚦 Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on http://0.0.0.0:${PORT}`);
});
