# Backend Tasks

This document outlines the various backend functions categorized by their respective areas. Each function is described with its purpose and 
functionality.

## Function Completion Status

This section records the completion status of each function. The status can be one of the following:
- Not Started
- Incomplete
- Testing Phase
- Integrated

## Account Management

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `get_registration_input`    | Collects user details (first name, last name, email, password) for registration  | Integrated      | Part of `AccountController.createAccount` |
| `validate_registration_input` | Checks required fields, validates email format, and ensures password strength  | Integrated      | Part of `AccountController.createAccount` |
| `check_email_unique`        | Verifies the email isn't already registered in the USERS table                   | Integrated      | Part of `AccountController.createAccount` |
| `store_user_account`        | Inserts new user data into the USERS table                                       | Integrated      | Part of `AccountController.createAccount` |
| `create_account`            | Coordinates account creation by calling the above functions                      | Integrated      | `AccountController.createAccount`      |

## Event Management

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `createEvent`               | Creates a new event after validating event details                               | Integrated      | `EventController.registerEvent`        |
| `modifyEvent`               | Updates an existing event with authorization checks                              | Not Started     | Not implemented                        |
| `deleteEvent`               | Deletes an event and removes related data (e.g., registrations)                  | Not Started     | Not implemented                        |
| `getEventDetails`           | Retrieves complete details for a specific event                                  | Not Started     | Not implemented                        |
| `listUpcomingEvents`        | Lists future events, optionally filtering by date or category                    | Incomplete      | Partially in `OrganizationController.getOrganizationEvents` |
| `notifyAttendees`           | Sends notifications to attendees when an event is modified or canceled           | Not Started     | Not implemented                        |

## Organization Management

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `createOrganization`        | Creates a new organization with required fields (name, description, images, etc.)| Integrated      | `OrganizationController.registerOrganization` |
| `modifyOrganization`        | Updates organization details with restrictions on certain fields                 | Not Started     | Not implemented                        |
| `joinOrganization`          | Allows a user to join an organization (updates membership records)               | Incomplete      | Stub in `Organization` class           |

## Calendar & Scheduling

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `eventFinder`               | Searches for events based on keywords and filters (date, category, location)     | Not Started     | Not implemented                        |
| `viewActivity`              | Retrieves detailed information for a selected event                              | Not Started     | Not implemented                        |
| `personalCalendar`          | Manages and retrieves events in a user's personal calendar                       | Not Started     | Not implemented                        |
| `switchCalendarView`        | Toggles between calendar views and applies or resets filters                     | Not Started     | Not implemented                        |

## Resource Management

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `checkAvailability`         | Checks if a location or equipment is available for a specified time range        | Incomplete      | `Landmark.checkAvailability` (stub)    |

## Notifications

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `sendNotification`          | Sends notifications (in-app or via email) to users                               | Not Started     | Not implemented                        |

## FAQ/Troubleshooting

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `getFAQs`                   | Retrieves FAQ entries for the support section                                    | Not Started     | Not implemented                        |
| `submitFeedback`            | Processes and stores user feedback                                               | Not Started     | Not implemented                        |

## Additional Implemented Functions

| Function                    | Description                                                                      | Status          | Implementation                         |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|----------------------------------------|
| `login`                     | Authenticates users and generates JWT token                                      | Integrated      | `AccountController.login`              |
| `getUserProfile`            | Retrieves user profile information                                               | Integrated      | `AccountController.getUserProfile`      |
| `getUserOrganizations`      | Gets organizations where user is an admin                                        | Integrated      | `OrganizationController.getUserOrganizations` |
| `getAllOrganizations`       | Lists all organizations in the system                                            | Integrated      | `OrganizationController.getAllOrganizations` |
| `deleteOrganization`        | Removes an organization and related data                                         | Integrated      | `OrganizationController.deleteOrganization` |

This document provides a comprehensive overview of the backend tasks, ensuring clarity and ease of understanding for developers and stakeholders.
