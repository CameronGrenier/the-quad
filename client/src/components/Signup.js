import React from 'react';

function Signup() {
  const handleSignup = (e) => {
    e.preventDefault();
    alert('Signup functionality to be implemented.');
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <div>
          <label>Name:</label>
          <input type="text" required />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" required />
        </div>
        <button type="submit">Create Account</button>
      </form>
    </div>
  );
}

export default Signup;
