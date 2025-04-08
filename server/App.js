const express = require('express');
const cors = require('cors');
const eventsRouter = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Dummy API endpoint for events
app.use('/api/events', eventsRouter);

app.get('/', (req, res) => {
  res.send('Server is running.');
});

app.listen(PORT, () => {
// console.log(`Server listening on port ${PORT}`);
});
