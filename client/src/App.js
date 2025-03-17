import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import MobileNavbar from './components/MobileNavbar';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1370);
  
  // Handle window resize and update isMobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1370);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        {!isMobile && <Header />}
        <main className={isMobile ? 'has-mobile-nav' : ''}>
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
        {isMobile && <MobileNavbar />}
      </Router>
    </AuthProvider>
  );
}

export default App;
