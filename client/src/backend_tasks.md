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

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `get_registration_input`    | Collects user details (first name, last name, email, password) for registration  | Not Started     |
| `validate_registration_input` | Checks required fields, validates email format, and ensures password strength  | Not Started     |
| `check_email_unique`        | Verifies the email isn’t already registered in the USERS table                   | Not Started     |
| `store_user_account`        | Inserts new user data into the USERS table                                       | Not Started     |
| `create_account`            | Coordinates account creation by calling the above functions                      | Not Started     |

## Event Management

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `createEvent`               | Creates a new event after validating event details                               | Not Started     |
| `modifyEvent`               | Updates an existing event with authorization checks                              | Not Started     |
| `deleteEvent`               | Deletes an event and removes related data (e.g., registrations)                  | Not Started     |
| `getEventDetails`           | Retrieves complete details for a specific event                                  | Not Started     |
| `listUpcomingEvents`        | Lists future events, optionally filtering by date or category                    | Not Started     |
| `notifyAttendees`           | Sends notifications to attendees when an event is modified or canceled           | Not Started     |

## Organization Management

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `createOrganization`        | Creates a new organization with required fields (name, description, images, etc.)| Not Started     |
| `modifyOrganization`        | Updates organization details with restrictions on certain fields                 | Not Started     |
| `joinOrganization`          | Allows a user to join an organization (updates membership records)               | Not Started     |

## Calendar & Scheduling

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `eventFinder`               | Searches for events based on keywords and filters (date, category, location)     | Not Started     |
| `viewActivity`              | Retrieves detailed information for a selected event                              | Not Started     |
| `personalCalendar`          | Manages and retrieves events in a user’s personal calendar                       | Not Started     |
| `switchCalendarView`        | Toggles between calendar views and applies or resets filters                     | Not Started     |

## Resource Management

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `checkAvailability`         | Checks if a location or equipment is available for a specified time range        | Not Started     |

## Notifications

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `sendNotification`          | Sends notifications (in-app or via email) to users                               | Not Started     |

## FAQ/Troubleshooting

| Function                    | Description                                                                      | Status          |
|-----------------------------|----------------------------------------------------------------------------------|-----------------|
| `getFAQs`                   | Retrieves FAQ entries for the support section                                    | Not Started     |
| `submitFeedback`            | Processes and stores user feedback                                               | Not Started     |


This README provides a comprehensive overview of the backend tasks, ensuring clarity and ease of understanding for developers and stakeholders.