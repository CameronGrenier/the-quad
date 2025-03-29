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
  async modifyAccountSettings() {
    /*
    // What does this function do?
    * Takes a form object and modifies the account settings of the user
    *Framework: 
    * Take the form object and parse it
    * Error Checks: 
    * If picture feild is empty, set it to the default picture
    * Throw errors:
    * (Check DB for duplicates)
    Username already exists
    Email already exists

    Errors resolved:
    use database service to save the new info into the user table
    */
  
  }
}
