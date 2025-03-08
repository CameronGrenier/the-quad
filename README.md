# The Quad: University Event Planner

Welcome to **The Quad** – an online platform designed to streamline university event planning and boost student engagement. This project uses React, Express, Node.js with Cloudflare services (Workers, D1, R2) to deliver a full-stack, responsive, and user-friendly application.

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

This project is built using the following technologies:

- **Cloudflare D1**: SQL database for storing event data, user profiles, room and equipment bookings, and more.
- **Cloudflare R2**: Object storage for images, media files, and other static assets.
- **Cloudflare Workers**: Serverless functions that power our API endpoints and handle backend logic.
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

- [Node.js](https://nodejs.org/en/) (v16.x or above)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (for Cloudflare Workers development)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- Git

### <a name="clone-the-repository"></a>Clone the Repository
```bash
git clone https://github.com/CameronGrenier/The-Quad.git
cd the-quad
```

### <a name="back-end-setup"></a>Back-End Setup
**1. Install Wrangler CLI globally:**
  ```bash
  npm install -g wrangler
  ```
**2. Login to Cloudflare:**
  ```bash
  wrangler login
  ```

**3. Configure Environment Variables:**
Create a `.dev.vars` file in the project root with your local development variables:
  ```env
  JWT_SECRET=your_jwt_secret
  ```

**4. Start the Workers development server:**
  ```bash
  wrangler dev
  ```

### <a name="front-end-setup"></a>Front-End Setup
**1. Navigate to the client directory:**
  ```bash
  cd client
  ```
**2. Install dependencies:**
  ```bash
  npm install
  ```
**3. Configure Environment Variables:**
Create a `.env` file in the `client` directory with the following:
  ```env
  REACT_APP_API_URL=http://localhost:8787
  ```
**4. Start the React Development Server:**
  ```bash
  npm start
  ```
The client should now be running on `http://localhost:3000` and communicating with the Cloudflare Workers development server.

## <a name="usage"></a>Usage
- **Developers:**
Use the provided development scripts to build, test, and deploy the application. Refer to the `package.json` files for available commands and `wrangler.toml` for Cloudflare Workers configuration.

- **End Users:**
Once deployed, users can register/log in, browse scheduled events, create new events (based on their role), manage resources, and more through an intuitive web interface.

## <a name="project-structure"></a>Project Structure
A high-level overview of the project's structure:
```csharp
the-quad/
├── client/                   # React front-end
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/         # API calls
│       └── App.js
├── client/src/worker.js      # Cloudflare Worker entry point
├── wrangler.toml             # Cloudflare Workers configuration
├── backend_info.md           # Backend documentation
├── README.md                 # This file
└── package.json              # Root-level package configuration
```

## <a name="contributing"></a>Contributing
To get started:
1. Fork the repository.
2. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request describing your changes.

