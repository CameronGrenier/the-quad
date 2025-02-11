import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import Login from './components/Login';
import Signup from './components/Signup';
import Calendar from './components/Calendar';
import EventDetails from './components/EventDetails';
import EventRegistration from './components/EventRegistration';
import Questionnaire from './components/Questionnaire';
import './App.css';

function App() {
  return (
    <Router>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/event/:id" element={<EventDetails />} />
          <Route path="/register-event" element={<EventRegistration />} />
          <Route path="/questionnaire" element={<Questionnaire />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
