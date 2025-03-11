import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

function Profile() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <div className="profile-container">
        <h2>Please log in to view your profile</h2>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2>My Profile</h2>
      
      <div className="profile-info">
        <div className="profile-header">
          <div className="profile-image">
            {currentUser.profile_picture ? (
              <img 
                src={currentUser.profile_picture.startsWith('/images/') 
                  ? `${process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev'}${currentUser.profile_picture}` 
                  : currentUser.profile_picture} 
                alt="Profile" 
              />
            ) : (
              <div className="default-avatar">
                {currentUser.f_name[0]}{currentUser.l_name[0]}
              </div>
            )}
          </div>
          <div className="profile-name">
            <h3>{currentUser.f_name} {currentUser.l_name}</h3>
          </div>
        </div>
        
        <div className="profile-details">
          <div className="detail-item">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{currentUser.email}</span>
          </div>
          
          {currentUser.phone && (
            <div className="detail-item">
              <span className="detail-label">Phone:</span>
              <span className="detail-value">{currentUser.phone}</span>
            </div>
          )}
          
          <button className="edit-profile-button">Edit Profile</button>
        </div>
      </div>
    </div>
  );
}

export default Profile;