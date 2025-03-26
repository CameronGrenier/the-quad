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
  async createAccount() { /* see AccountController.createAccount */ }
  async modifyAccountSettings() { /* implement as needed */ }
}