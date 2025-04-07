import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import './LocationMap.css';

// Store API key directly or use environment variable
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCT7Oi6lj9KCLeJ8khaNyv_-rziY6oMcjo";

const containerStyle = {
  width: '100%',
  height: '300px'
};

const defaultCenter = {
  lat: 43.47387, // 43°28'25.8"N converted to decimal
  lng: -80.52748 // 80°31'38.8"W converted to decimal
};

function LocationMap({ onLocationSelect, initialLocation, searchInputRef }) {
  const [center, setCenter] = useState(initialLocation || defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(initialLocation || null);
  const [mapInstance, setMapInstance] = useState(null);
  const geocoderRef = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // Handle map load
  const handleMapLoad = (map) => {
    setMapInstance(map);
    setIsMapLoaded(true);
    
    // Only create geocoder after map is loaded and Google API is available
    if (window.google && window.google.maps) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  };
  
  // Set up search box after map is loaded
  useEffect(() => {
    if (!isMapLoaded || !searchInputRef || !searchInputRef.current || !window.google || !mapInstance) {
      return;
    }
    
    try {
      const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);
      
      // Bias the search box results towards the current map viewport
      mapInstance.addListener('bounds_changed', () => {
        searchBox.setBounds(mapInstance.getBounds());
      });
      
      // Listen for place selection
      searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        
        if (places.length === 0) {
          return;
        }
        
        // For each place, get the location
        const bounds = new window.google.maps.LatLngBounds();
        places.forEach(place => {
          if (!place.geometry || !place.geometry.location) {
            console.log("Returned place contains no geometry");
            return;
          }
          
          const position = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          };
          
          setMarkerPosition(position);
          setCenter(position);
          
          // Pass the location data to the parent component
          onLocationSelect({
            name: place.name,
            address: place.formatted_address,
            coordinates: position
          });
          
          if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
          } else {
            bounds.extend(place.geometry.location);
          }
        });
        
        mapInstance.fitBounds(bounds);
      });
      
    } catch (error) {
      console.error("Error setting up search box:", error);
    }
  }, [isMapLoaded, mapInstance, searchInputRef, onLocationSelect]);
  
  const handleMapClick = (event) => {
    const position = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };
    
    setMarkerPosition(position);
    
    // Get the address for the clicked location
    if (geocoderRef.current) {
      try {
        geocoderRef.current.geocode({ location: position }, (results, status) => {
          if (status === "OK" && results[0]) {
            onLocationSelect({
              name: results[0].formatted_address.split(',')[0],
              address: results[0].formatted_address,
              coordinates: position
            });
          } else {
            // Fallback for geocoding failures
            onLocationSelect({
              name: `Custom Location (${position.lat.toFixed(6)}, ${position.lng.toFixed(6)})`,
              address: `Lat: ${position.lat.toFixed(6)}, Lng: ${position.lng.toFixed(6)}`,
              coordinates: position
            });
          }
        });
      } catch (error) {
        console.error("Geocoding error:", error);
        // Fallback if geocoding throws an error
        onLocationSelect({
          name: `Custom Location`,
          address: `Latitude: ${position.lat.toFixed(6)}, Longitude: ${position.lng.toFixed(6)}`,
          coordinates: position
        });
      }
    } else {
      // Fallback if geocoder isn't available
      onLocationSelect({
        name: `Custom Location`,
        address: `Latitude: ${position.lat.toFixed(6)}, Longitude: ${position.lng.toFixed(6)}`,
        coordinates: position
      });
    }
  };
  
  return (
    <div className="location-map-container">
      <LoadScript
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        libraries={["places"]}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          onClick={handleMapClick}
          onLoad={handleMapLoad}
        >
          {markerPosition && (
            <Marker
              position={markerPosition}
              draggable={true}
              onDragEnd={(e) => handleMapClick(e)}
            />
          )}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}

export default LocationMap;