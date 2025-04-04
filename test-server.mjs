import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('✅ Hello from test server!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server listening on http://0.0.0.0:${PORT}`);
});
