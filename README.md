# The Quad: University Event Planner

Welcome to **The Quad** – an online platform designed to streamline university event planning and boost student engagement. This project uses the PERN stack (PostgreSQL, Express, React, Node.js) to deliver a full-stack, responsive, and user-friendly application.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Clone the Repository](#clone-the-repository)
  - [Back-End Setup](#back-end-setup)
  - [Front-End Setup](#front-end-setup)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## <a name="project-overview"></a>Project Overview

**The Quad** is built to serve as a centralized event planning platform for university students. It integrates formal events (organized by the Students Union or clubs) with informal student-led initiatives. The application aims to simplify event scheduling, streamline resource bookings, and provide robust marketing tools.

## <a name="tech-stack"></a>Tech Stack

This project is built using the **PERN** stack:

- **PostgreSQL**: Our relational database for storing event data, user profiles, room and equipment bookings, and more.
- **Express.js**: The back-end framework that powers our API, handles routing, and manages middleware for requests.
- **React**: Our front-end library for building a dynamic, responsive user interface that enhances the user experience.
- **Node.js**: The runtime environment for executing JavaScript on the server, running our Express server, and handling back-end logic.

## <a name="features"></a>Features

- **Centralized Scheduling**: Manage and display all university events on a unified calendar.
- **Drag-and-Drop Interface**: Intuitive scheduling with an interactive calendar and event management UI.
- **Resource Management**: Real-time room and equipment availability checks, automated booking requests, and conflict management.
- **Automated Notifications**: Email reminders and alerts for upcoming deadlines and events.
- **Event Marketing**: Tools for uploading images/videos, creating event pages, RSVP tracking, and social media integration.
- **User Roles & Permissions**: Distinguish between formal (Students Union/Club) and informal (student-led) event organizers with tiered access.

## Installation

Follow these steps to set up the development environment.

### <a name="prerequisites"></a>Prerequisites

- [Node.js](https://nodejs.org/en/) (v14.x or above)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [PostgreSQL](https://www.postgresql.org/) (v12.x or above)
- Git

### <a name="clone-the-repository"></a>Clone the Repository
git clone https://github.com/yourusername/the-quad.git](https://github.com/CameronGrenier/The-Quad.git
cd the-quad

### <a name="back-end-setup"></a>Back-End Setup
**1. Navigate to the server directory:**
  >```bash
  >cd server
  >```
**2. Install dependencies:##
>```
>npm install
>bash
**3. Configure Environment Variables:**
Create a `.env` file in the `server` directory with the following variables (adjust values as needed):
>```env
>PORT=5000
>DATABASE_URL=postgres://username:password@localhost:5432/thequad
>JWT_SECRET=your_jwt_secret
>```
**4. Run Database Migrations (if applicable):**
>```bash
>npm run migrate
>```
**5. Start the Server:**
>```bash
>npm run dev
>```
### <a name="front-end-setup"></a>Front-End Setup
**1. Navigate to the client directory:**
>```bash
>cd ../client
>```
**2. Install dependencies:**
>```bash
>npm install
>```
**3. Configure Environment Variables:**
Create a `.env` file in the `client` directory with the following (if needed):
>```env
>REACT_APP_API_URL=http://localhost:5000
>```
**4. Start the React Development Server:**
>```bash
>npm start
>```
The client should now be running on `http://localhost:3000` and communicating with the back-end server.

## <a name="usage"></a>Usage
- **Developers:**
Use the provided development scripts to build, test, and deploy the application. Refer to the `package.json` files in both the `client` and `server` directories for available commands.

- **End Users:**
Once deployed, users can register/log in, browse scheduled events, create new events (based on their role), manage resources, and more through an intuitive web interface.

## <a name="project-structure"></a>Project Structure
A high-level overview of the project’s structure:
```csharp
the-quad/
├── client/                # React front-end
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/      # API calls
│       └── App.js
├── server/                # Express back-end
│   ├── controllers/       # Request handling logic
│   ├── models/            # Database models & queries
│   ├── routes/            # API endpoints
│   ├── middleware/        # Authentication, error handling
│   ├── utils/             # Utility functions
│   └── server.js          # App entry point
├── README.md              # This file
└── package.json           # Root-level package configuration (if applicable)
```
## <a name="contributing"></a>Contributing
To get started:
1. Fork the repository.
2. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request describing your changes.
Please refer to our CONTRIBUTING.md file for more details.

