import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ options, value, onChange, name, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(
    options.find(option => option.value === value) || 
    (options.length > 0 ? options[0] : { value: '', label: placeholder || 'Select...' })
  );
  const dropdownRef = useRef(null);
  
  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Update selected option when value changes externally
  useEffect(() => {
    const option = options.find(opt => opt.value === value);
    if (option) {
      setSelectedOption(option);
    } else if (value === '' || value === undefined) {
      setSelectedOption({ value: '', label: placeholder || 'Select...' });
    }
  }, [value, options, placeholder]);
  
  const handleOptionClick = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    
    // Create a synthetic event-like object for onChange handler
    const syntheticEvent = {
      target: {
        name,
        value: option.value
      }
    };
    onChange(syntheticEvent);
  };
  
  return (
    <div className="custom-select-container" ref={dropdownRef}>
      {/* Hidden native select for form submission */}
      <select name={name} value={value} onChange={onChange} style={{ display: 'none' }}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {/* Custom select button */}
      <div 
        className={`custom-select-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption.label}
      </div>
      
      {/* Dropdown options */}
      <div className={`custom-select-dropdown ${isOpen ? 'open' : ''}`}>
        {options.map(option => (
          <div
            key={option.value}
            className={`custom-select-option ${option.value === selectedOption.value ? 'selected' : ''}`}
            onClick={() => handleOptionClick(option)}
          >
            {option.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomSelect;