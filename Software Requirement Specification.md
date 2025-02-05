# Software Requirements Specification (SRS)
## The Quad: University Event Planner

---

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to define the functional and non-functional requirements for **The Quad**, a University Event Planner. This SRS outlines the specifications for the development of a web-based platform aimed at streamlining event scheduling, resource management, and event marketing for university communities. It is intended for use by the development team, project stakeholders, and future maintainers.

### 1.2 Scope
**The Quad** will serve as a centralized platform for both formal and informal university events. Key functionalities include:
- Scheduling and managing events.
- Managing resources such as rooms and equipment.
- Providing tools for event marketing and promotion.
- Facilitating user interactions and engagement through an intuitive interface.

The system is designed to support two primary categories of events:
- **Formal Events:** Organized by the Students Union or clubs (e.g., speaker series, workshops).
- **Informal Events:** Student-led initiatives (e.g., group study sessions, social meetups).

### 1.3 Definitions, Acronyms, and Abbreviations
- **SRS:** Software Requirements Specification.
- **UI:** User Interface.
- **UX:** User Experience.
- **CRUD:** Create, Read, Update, Delete.
- **REST:** Representational State Transfer.
- **PERN:** PostgreSQL, Express, React, Node.js.

### 1.4 References
- IEEE Std 830-1998, IEEE Recommended Practice for Software Requirements Specifications.
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [React Documentation](https://reactjs.org/docs/getting-started.html)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [Express.js Documentation](https://expressjs.com/)

### 1.5 Overview
This document is organized as follows:
- **Section 2:** Provides an overall description of the product, including user characteristics and constraints.
- **Section 3:** Details the specific functional and non-functional requirements of the system.
- **Section 4:** Outlines any supporting information that assists in the understanding and implementation of the project.

---

## 2. Overall Description

### 2.1 Product Perspective
**The Quad** is a standalone web application built using the PERN stack. It is designed to integrate seamlessly with university resources and will be developed using industry best practices. The application will communicate with a PostgreSQL database to manage events and resource bookings and will provide a responsive interface using React.

### 2.2 Product Functions
The main functions of **The Quad** include:
- **Event Scheduling:** 
  - Create, modify, and delete events.
  - Drag-and-drop calendar interface.
  - Event recurrence and template creation.
- **Resource Management:** 
  - Check real-time availability of rooms and equipment.
  - Automated booking requests and conflict resolution.
- **Event Marketing:** 
  - Create and publish event pages.
  - Support for multimedia content (images, videos).
  - RSVP management, waitlist functionality, and social media integration.
- **User Management:** 
  - Role-based access control (administrators, formal event organizers, and student users).
  - Registration and authentication.

### 2.3 User Classes and Characteristics
- **Formal Event Organizers:**  
  Users from the Students Union or clubs who require advanced scheduling and resource management features.
- **Informal Event Organizers:**  
  Students planning peer-led events who need a simple interface for scheduling and promotion.
- **General Users:**  
  University students looking to browse, filter, and join events of interest.
- **Administrators:**  
  Users with elevated privileges for overseeing event scheduling, user management, and system configurations.

### 2.4 Operating Environment
- **Client-Side:**  
  Modern web browsers (Chrome, Firefox, Edge, Safari) on desktops, laptops, tablets, and smartphones.
- **Server-Side:**  
  Node.js/Express running on a Linux-based server or local development machine.
- **Database:**  
  PostgreSQL 12 or later.
- **Development Environment:**  
  Docker containers (optional) or local installations for development and testing.

### 2.5 Design and Implementation Constraints
- **Technology Constraints:**  
  The application will be built using JavaScript for both client and server. SQL will be used for database operations.
- **Security Constraints:**  
  Data privacy and security measures must be implemented to protect sensitive user information.
- **Performance Constraints:**  
  The system should be responsive with minimal downtime, even under peak usage conditions during major campus events.
- **Interface Constraints:**  
  The UI must be accessible and responsive, adhering to modern web accessibility standards.

### 2.6 User Documentation
User documentation will include:
- **Online Help:** Context-sensitive help integrated within the web application.
- **User Manuals:** Detailed guides for different user roles.
- **Training Materials:** Tutorials, quick start guides, and possibly video walkthroughs.

### 2.7 Assumptions and Dependencies
- Assumes that users have access to modern web browsers.
- Depends on the reliability of the PostgreSQL database and the stability of the PERN stack.
- Assumes collaboration and timely feedback from university stakeholders and potential end-users.

---

## 3. Specific Requirements

### 3.1 Functional Requirements
#### 3.1.1 Event Management
- **FR1:** The system shall allow authorized users to create new events with details such as title, date, time, location, and description.
- **FR2:** The system shall provide functionality for editing and deleting existing events.
- **FR3:** The system shall support recurring events and allow the use of event templates.
- **FR4:** The system shall include a drag-and-drop calendar interface for scheduling events.

#### 3.1.2 Resource Management
- **FR5:** The system shall integrate with university resources to check the real-time availability of rooms and equipment.
- **FR6:** The system shall allow authorized users to book resources automatically and manage booking conflicts.
- **FR7:** The system shall prioritize resource bookings for formal events over informal events as defined by user roles.

#### 3.1.3 Event Marketing
- **FR8:** The system shall provide tools for uploading images and videos to event pages.
- **FR9:** The system shall support RSVP tracking and waitlist management.
- **FR10:** The system shall enable integration with social media platforms for event promotion.

#### 3.1.4 User Management
- **FR11:** The system shall support user registration and authentication.
- **FR12:** The system shall implement role-based access control to restrict functionalities according to user roles.
- **FR13:** The system shall allow users to update their profiles and preferences.

### 3.2 Performance Requirements
- **PR1:** The system shall load the event scheduling interface within 3 seconds on a standard broadband connection.
- **PR2:** The system shall handle at least 100 concurrent users without significant performance degradation.
- **PR3:** Database queries for event retrieval and resource checks shall return results within 2 seconds.

### 3.3 Logical Database Requirements
- **DB1:** The PostgreSQL database shall store event data, user profiles, and resource bookings.
- **DB2:** The database schema shall be designed to ensure referential integrity and support scalability.
- **DB3:** Database migration scripts shall be version-controlled and executed automatically during deployment.

### 3.4 Design Constraints
- **DC1:** The application must be developed using the PERN stack (PostgreSQL, Express, React, Node.js).
- **DC2:** The UI must be responsive and compatible with modern web browsers.
- **DC3:** The system must comply with standard security practices, including encrypted communication (HTTPS) and secure password storage.

### 3.5 Software System Attributes
#### 3.5.1 Reliability
- The system shall have a downtime of less than 1% per month.
  
#### 3.5.2 Availability
- The system shall be available 24/7 for authorized users, with scheduled maintenance windows communicated in advance.

#### 3.5.3 Security
- The system shall enforce strong password policies and use encryption for data in transit.
- The system shall implement role-based access control and audit logging.

#### 3.5.4 Maintainability
- The codebase shall be modular and well-documented to facilitate future enhancements and maintenance.
  
#### 3.5.5 Usability
- The system shall provide an intuitive and user-friendly interface to minimize the learning curve for new users.

### 3.6 Other Requirements
- **OR1:** The system shall support localization, with English as the primary language.
- **OR2:** The system shall be designed with scalability in mind to accommodate future growth in user base and data volume.
- **OR3:** The system shall log user activities for audit purposes and support troubleshooting.

---

## 4. Appendices

### 4.1 Glossary
- **Event:** A scheduled activity on the campus calendar.
- **Resource:** A physical asset (e.g., room or equipment) available for booking.
- **User Role:** Defines the permissions available to a user (e.g., formal event organizer, informal event organizer, administrator).

### 4.2 Supporting Information
Additional supporting documents, design diagrams, and test plans will be maintained in the project repository and referenced as needed.
