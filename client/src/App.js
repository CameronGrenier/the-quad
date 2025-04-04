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
import MyOrganizations from './components/MyOrganizations';
import ExploreEvents from './components/ExploreEvents';
import EventPage from './components/EventPage';
import EventList from './components/EventList'; // Note the 's' in EventsList
import MyEvents from './components/MyEvents';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import EditOrganization from './components/EditOrganization';
import AdminDashboard from './components/AdminDashboard';
import PersonalCalendar from './components/PersonalCalendar';
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
        <div className="app-container"> {/* Add this wrapper */}
          {!isMobile && <Header />}
          <main className={`main-content ${isMobile ? 'has-mobile-nav' : ''}`}> {/* Add this wrapper */}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/calendar" element={<PersonalCalendar />} />
              <Route path="/events/:id" element={<EventPage />} />
              <Route path="/register-event" element={<EventRegistration />} />
              <Route path="/register-organization" element={<OrganizationRegistration />} /> 
              <Route path="/questionnaire" element={<Questionnaire />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/organizations" element={<OrganizationList />} />
              <Route path="/organizations/:orgId" element={<OrganizationPage />} />
              <Route path="/my-organizations" element={<MyOrganizations />} />
              <Route path="/events" element={<ExploreEvents />} />
              <Route path="/my-events" element={<MyEvents />} /> {/* New route */}
              <Route path="/edit-organization/:orgId" element={
                <PrivateRoute>
                  <EditOrganization />
                </PrivateRoute>
              } />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          {isMobile && <MobileNavbar />}
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
