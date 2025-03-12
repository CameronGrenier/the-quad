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
import OrganizationRegistration from './components/OrganizationRegistration';
import Profile from './components/Profile';
import OrganizationPage from './components/OrganizationPage';
import OrganizationList from './components/OrganizationList';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
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
            <Route path="/register-organization" element={<OrganizationRegistration />} /> 
            <Route path="/questionnaire" element={<Questionnaire />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/organizations" element={<OrganizationList />} />
            <Route path="/organizations/:orgId" element={<OrganizationPage />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
