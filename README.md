# CampusAid 
### A Centralized Intelligent Platform for Navigating Student Support Services

> Built for Ashesi University | Applied Project | B.Sc. Computer Science

**Student:** Isabella Tsikata  
**Supervisor:** Mr. Dennis Owusu  
**Institution:** Ashesi University  
**Year:** 2026

 **Live App:** [https://campus-aid-production.up.railway.app/](https://campus-aid-production.up.railway.app/)

---

## Overview

Student support services at Ashesi University — Career Services, Academic Advising, ODIP, and more — are spread across emails, departmental pages, and in-person visits. CampusAid brings them all into one intelligent, centralized web platform.

The platform combines four core components:

-  **Unified Service Directory** — discover all available student support services in one place
-  **AI Conversational Assistant** — RAG-powered chatbot grounded in institutional documents for accurate, Ashesi-specific answers
-  **Appointment Management** — students book appointments; staff confirm or decline with reasons
-  **Real-Time Messaging** — live chat between students and service office staff via Socket.IO

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Database | MySQL |
| Real-Time | Socket.IO |
| AI / RAG | OpenAI GPT API + Embeddings |
| Email | Nodemailer |
| Auth | Session-based + bcrypt + OTP |
| Deployment | Railway |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://dev.mysql.com/downloads/) v8.0+
- An [OpenAI API Key](https://platform.openai.com/api-keys)
- Git

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Isabella1025/campus-aid.git
cd campus-aid
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=3000

DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=campusaid

OPENAI_API_KEY=your_openai_api_key

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

SESSION_SECRET=your_secret_key
```

### 4. Set up the database

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE campusaid;"

# Run the schema
mysql -u root -p campusaid < database/schema.sql

# (Optional) Seed with sample data
mysql -u root -p campusaid < database/seed.sql
```

### 5. Start the server

```bash
npm start
```

Visit **http://localhost:3000** in your browser.

---

## Project Structure

```
campus-aid/
├── backend/
│   ├── app.js                    # Express app config & middleware
│   ├── server.js                 # HTTP server & Socket.IO init
│   ├── middleware/
│   │   └── permission.middleware.js
│   ├── models/
│   │   ├── Service.js
│   │   └── Appointment.js
│   ├── routes/
│   │   ├── auth.router.js
│   │   ├── service.router.js
│   │   ├── appointment.router.js
│   │   ├── channel.router.js
│   │   ├── bot.router.js
│   │   ├── file.router.js
│   │   ├── notifications.router.js
│   │   ├── user.router.js
│   │   └── analytics.router.js
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── EmailService.js
│   │   ├── BotService.js
│   │   ├── DocumentService.js
│   │   └── VectorStoreService.js
│   └── sockets/
│       └── socketHandler.js
├── frontend/
│   └── public/
│       ├── index.html            # Login / Signup / OTP
│       ├── services.html         # Student service directory
│       ├── chat.html             # Real-time messaging
│       ├── appointments.html     # Appointment booking
│       ├── profile.html
│       ├── staff-dashboard.html
│       ├── admin.html            # Admin: docs, bots, analytics
│       ├── analytics.html
│       └── ...
├── database/
│   ├── schema.sql                # Full schema (15 tables)
│   └── seed.sql                  # Sample data
├── tests/
│   └── integration/
├── .env.example
├── docker-compose.yml
└── package.json
```

---

## User Roles

| Role | Capabilities |
|---|---|
| **Student** | Browse services, chat with AI, book appointments, message staff |
| **Staff** | Manage appointments, respond to student messages |
| **Admin** | Upload knowledge base documents, manage services, view analytics |

---

## How the AI Works

CampusAid uses **Retrieval-Augmented Generation (RAG)**. Each service office has its own knowledge base. When an admin uploads documents (PDFs, guides, FAQs), the system:

1. Extracts the text content
2. Generates semantic embeddings using OpenAI's embedding model
3. Stores them in a per-service vector store

When a student asks a question, the system retrieves the most relevant document excerpts and passes them to GPT to generate an accurate, Ashesi-specific answer — reducing hallucination and keeping responses grounded in real institutional information.

---

## Testing

```bash
npm test
```

Integration tests are located in `tests/integration/`.

---

## Deployment

The app is deployed on [Railway](https://railway.app/).  
Live URL: [https://campus-aid-production.up.railway.app/](https://campus-aid-production.up.railway.app/)

To deploy your own instance, ensure all environment variables are configured in your Railway (or other platform) dashboard.

---

## Acknowledgements

- Ashesi University for institutional support
- OpenAI for the GPT and Embeddings APIs
- Socket.IO for real-time communication tooling

---

## Contact

**Isabella Tsikata**  
isabella.tsikata@ashesi.edu.gh  
Ashesi University, Class of 2026
