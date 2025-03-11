import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css'; // You'll need to create this

// Define the API URL using environment variables
const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    f_name: '',
    l_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailExistsError, setEmailExistsError] = useState('');

  const handleChange = async (e) => {
    const { name, value } = e.target;
    
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));

    // Check if email already exists when email field changes
    if (name === 'email' && value.trim() !== '') {
      try {
        const response = await fetch(`${API_URL}/api/check-email?email=${value}`, {
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        
        if (result.exists) {
          setEmailExistsError('This email is already registered.');
        } else {
          setEmailExistsError('');
        }
      } catch (error) {
        console.error('Error checking email:', error);
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate first name
    if (!formData.f_name.trim()) {
      newErrors.f_name = 'First name is required';
    }
    
    // Validate last name
    if (!formData.l_name.trim()) {
      newErrors.l_name = 'Last name is required';
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Validate phone (optional but must be valid if provided)
    const phoneRegex = /^\d{10}$/;
    if (formData.phone && !phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    
    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }
    
    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (emailExistsError) {
      return; // Don't proceed if email already exists
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          f_name: formData.f_name,
          l_name: formData.l_name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store token in localStorage
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to home page or dashboard
        navigate('/');
      } else {
        setErrors({ form: data.error || 'Registration failed. Please try again.' });
      }
    } catch (error) {
      console.error('Error during signup:', error);
      setErrors({ form: 'An unexpected error occurred. Please try again later.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container">
      <h2>Create Your Account</h2>
      
      {errors.form && <div className="error-message">{errors.form}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="f_name">First Name</label>
          <input
            type="text"
            id="f_name"
            name="f_name"
            value={formData.f_name}
            onChange={handleChange}
            className={errors.f_name ? 'error' : ''}
          />
          {errors.f_name && <span className="error-text">{errors.f_name}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="l_name">Last Name</label>
          <input
            type="text"
            id="l_name"
            name="l_name"
            value={formData.l_name}
            onChange={handleChange}
            className={errors.l_name ? 'error' : ''}
          />
          {errors.l_name && <span className="error-text">{errors.l_name}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={(errors.email || emailExistsError) ? 'error' : ''}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
          {emailExistsError && <span className="error-text">{emailExistsError}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">Phone Number (Optional)</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={errors.phone ? 'error' : ''}
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={errors.confirmPassword ? 'error' : ''}
          />
          {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
        </div>
        
        <button type="submit" className="signup-button" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
}

export default Signup;
