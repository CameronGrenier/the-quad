/*
 -------------------------------------------------------
 File:     user.js
 About:    User schema
 Author:   Humayoun Khan
 Version:  2025-03-22 1.0
 -------------------------------------------------------
 */

//This file is used to define the user object that will be used to in computation user verification and authentication. 
//User object is decomposed to be added to the database when a new user is created.
//Defining a user object:
//What is needed from the front end signup form is the following:

/*
=========================================================
User Object Definition
=========================================================
Information obtained from front end signup form:
Required Fields:
- email (String)
- password (String)
- First Name (String)
- Last Namen (String)
- Phone Number (String)

Optional Fields:
-profilePicture (String)
---------------------------------------------------------
Additional Required Fields:
-UserID (int) - needs to be unique for each user 
*/

