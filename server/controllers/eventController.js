// Dummy controller to return some events
exports.getEvents = (req, res) => {
    const dummyEvents = [
      { id: 1, title: 'Study Session', date: '2025-03-10' },
      { id: 2, title: 'Guest Lecture', date: '2025-03-12' }
    ];
    res.json(dummyEvents);
  };
  