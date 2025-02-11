import React from 'react';

function Questionnaire() {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Questionnaire submission to be implemented.');
  };

  return (
    <div>
      <h2>Event Preferences</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Select your interests:</label>
          <select multiple required>
            <option value="academic">Academic</option>
            <option value="social">Social</option>
            <option value="sports">Sports</option>
            <option value="career">Career</option>
          </select>
        </div>
        <button type="submit">Submit Preferences</button>
      </form>
    </div>
  );
}

export default Questionnaire;
