// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Dummy event data
const events = [
  { id: 1, title: "Welcome Party", date: "2025-03-15", description: "Kick off event for new students" },
  { id: 2, title: "Study Session", date: "2025-03-16", description: "Group study session in the library" },
  { id: 3, title: "Guest Lecture", date: "2025-03-17", description: "Lecture by an industry expert" }
];

// API endpoint to fetch events
app.get('/api/events', (req, res) => {
  res.json(events);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
