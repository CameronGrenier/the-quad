/**
 * User class represents a user in the system.
 */
export class User {
  constructor({ userID, username, fName, lName, email, phone, profilePicture }) {
    this.userID = userID;
    this.username = username;
    this.fName = fName;
    this.lName = lName;
    this.email = email;
    this.phone = phone;
    this.profilePicture = profilePicture;
  }
 //Create Account function implemented in account controller class
 //Moving modify account settings to account controller class
  async modifyAccountSettings() { /* implement as needed */ }
}