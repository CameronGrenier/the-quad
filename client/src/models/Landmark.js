/**
 * Landmark class represents a landmark in the system.
 */
export class Landmark {
  constructor({ landmarkID, name, location, multiEventAllowed }) {
    this.landmarkID = landmarkID;
    this.name = name;
    this.location = location;
    this.multiEventAllowed = multiEventAllowed;
  }
  async checkAvailability(dateRange) {
    // Check to see if a location is available at a given date range
    // Case: Multi Event Allowed 
    return true;
  }
}