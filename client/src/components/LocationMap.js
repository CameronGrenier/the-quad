import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import './LocationMap.css';

// API key from environment variable
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Map container styles
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '8px'
};

// Default center (can be set to a university campus coordinate)
const defaultCenter = {
  lat: 33.7490, // Example: Atlanta, GA coordinates
  lng: -84.3880
};

const LocationMap = ({ onLocationSelect, initialLocation = null, searchInputRef }) => {
  // State for map and marker
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(initialLocation);
  const [address, setAddress] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [mapError, setMapError] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);
  
  // Load the map
  const onMapLoad = useCallback((map) => {
    setMap(map);
    setLoadingMap(false);
    
    // Initialize places search if ref is provided
    if (searchInputRef?.current && window.google) {
      const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);
      
      // Listen for places selection
      searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        if (places && places.length > 0) {
          const place = places[0];
          
          if (place.geometry && place.geometry.location) {
            const location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            };
            
            setMarker(location);
            setAddress(place.formatted_address || '');
            setPlaceName(place.name || '');
            
            // Center the map on the selected place
            map.panTo(location);
            
            // Pass location info to parent component
            onLocationSelect({
              coordinates: location,
              address: place.formatted_address || '',
              name: place.name || place.formatted_address || ''
            });
          }
        }
      });
      
      // Bias search box results to current map viewport
      map.addListener('bounds_changed', () => {
        searchBox.setBounds(map.getBounds());
      });
    }
  }, [onLocationSelect, searchInputRef]);

  // Error handler for map loading
  const handleMapError = useCallback(() => {
    setMapError(true);
    setLoadingMap(false);
  }, []);

  // Update the handleMapClick function to use the full address
  const handleMapClick = useCallback((event) => {
    if (!window.google) return;
    
    try {
      const location = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      setMarker(location);
      
      // Get address from coordinates using Geocoding API
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location }, (results, status) => {
        if (status === "OK" && results[0]) {
          const formattedAddress = results[0].formatted_address;
          setAddress(formattedAddress);
          
          // Use a better name for the location
          let name = formattedAddress;
          
          // Try to extract a more meaningful name
          const addressComponents = results[0].address_components;
          
          // First check for point of interest or establishment
          for (const component of addressComponents) {
            if (component.types.includes('point_of_interest') || 
                component.types.includes('establishment')) {
              name = component.long_name;
              break;
            }
          }
          
          // If we didn't find a POI, use the street address
          if (name === formattedAddress) {
            // Try to build a street address from components
            let streetNumber = '';
            let route = '';
            
            for (const component of addressComponents) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name;
              }
              if (component.types.includes('route')) {
                route = component.long_name;
              }
            }
            
            if (streetNumber && route) {
              name = `${streetNumber} ${route}`;
            } else {
              // Just use the first part of the address if we can't build a street address
              name = formattedAddress.split(',')[0];
            }
          }
          
          setPlaceName(name);
          
          // Pass complete location info to parent component
          onLocationSelect({
            coordinates: location,
            address: formattedAddress,
            name: formattedAddress // Use the full address instead of just the name
          });
        }
      });
    } catch (error) {
      console.error("Error processing map click:", error);
    }
  }, [onLocationSelect]);

  // Fallback when Maps API fails to load
  if (mapError) {
    return (
      <div className="map-error-container">
        <div className="map-error-message">
          <h3>Map couldn't be loaded</h3>
          <p>Please enter a location name manually.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="location-map-container">
      <LoadScript
        googleMapsApiKey={API_KEY}
        libraries={["places"]}
        onError={handleMapError}
        loadingElement={<div className="map-loading">Loading map...</div>}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={marker || defaultCenter}
          zoom={15}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            styles: [
              {
                "featureType": "all",
                "elementType": "geometry",
                "stylers": [
                  { "color": "#242f3e" }
                ]
              },
              {
                "featureType": "all",
                "elementType": "labels.text.fill",
                "stylers": [
                  { "color": "#746855" }
                ]
              },
              {
                "featureType": "all",
                "elementType": "labels.text.stroke",
                "stylers": [
                  { "color": "#242f3e" }
                ]
              },
              {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [
                  { "color": "#17263c" }
                ]
              }
            ],
            streetViewControl: false
          }}
        >
          {marker && <Marker position={marker} />}
        </GoogleMap>
        
        {address && (
          <div className="selected-location-info">
            <div className="location-name">{placeName || 'Selected Location'}</div>
            <div className="location-address">{address}</div>
          </div>
        )}
        
        {loadingMap && (
          <div className="map-loading-overlay">
            <div className="map-loading-spinner"></div>
            <p>Loading map...</p>
          </div>
        )}
      </LoadScript>
    </div>
  );
};

export default LocationMap;