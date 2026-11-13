# ✦ SkillSwap

### Learn Together. Teach Freely. Grow Together.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudinary-Media-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white" />
</p>

---

## 🌱 About SkillSwap

**SkillSwap** is a student-focused skill-sharing and networking platform that brings learners and teachers together in one collaborative community.

It creates an environment where people can discover new skills, share knowledge, connect with like-minded individuals, and learn through meaningful interactions.

Whether you want to teach something you know or learn something new, SkillSwap makes knowledge sharing more accessible and engaging.

---

## ✨ Features

| Feature | Description |
|---|---|
| 👤 User Profiles | Create and personalize your profile with skills, interests, and profile media. |
| 📝 Posts & Stories | Share ideas, experiences, updates, and learning progress. |
| 🔍 Explore & Search | Discover users, content, and skills across the community. |
| 🤝 Connections | Follow users and build your learning network. |
| 💬 Real-time Messaging | Communicate through direct and group conversations. |
| 👥 Group Conversations | Collaborate and communicate with multiple members. |
| ❤️ Social Interactions | Like, comment, react, and engage with posts. |
| 🔖 Bookmarks | Save posts to revisit whenever you need them. |
| 🖼️ Media Sharing | Upload and share images and videos. |
| 🔐 Secure Authentication | Authentication with password hashing, JWT, and sessions. |

---

## 🛠️ Tech Stack

### Frontend
- React 19
- Vite
- React Router
- Tailwind CSS
- Framer Motion
- Lucide React

### Backend
- Node.js
- Express.js
- Socket.IO
- REST API

### Database & Storage
- MongoDB
- Mongoose
- Cloudinary

### Authentication & Security
- JSON Web Tokens (JWT)
- bcrypt
- HTTP-only cookies
- Session management
- Zod validation

### Development & Testing
- Git & GitHub
- ESLint
- Vitest
- npm

---

## 🏗️ Project Structure

```text
SkillSwap/
│
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── services/
│   └── server.js
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── routes/
│       ├── services/
│       └── utils/
│
├── scripts/
├── tests/
│   └── unit/
│
├── .gitignore
├── package.json
├── package-lock.json
└── vitest.config.js
```

---

## 🚀 Getting Started

Follow these steps to run SkillSwap locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- npm
- [MongoDB](https://www.mongodb.com/)
- A [Cloudinary](https://cloudinary.com/) account

### 1. Clone the Repository

```bash
git clone https://github.com/Naman-1906/SkillSwap.git
cd SkillSwap
```

### 2. Install Dependencies

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 3. Configure Environment Variables

Create a `.env` file in the project root and configure the required credentials.

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Add any additional environment variables required by the application.

**Never commit your actual `.env` file or expose credentials publicly.**

### 4. Start the Application

```bash
npm run dev
```

The frontend and backend development servers should start according to the project's configuration.

---

## 🧪 Testing

Run the unit tests using:

```bash
npm test
```

Run lint checks using:

```bash
npm run lint
```

---

## 🎯 Project Objective

SkillSwap aims to encourage collaborative learning by connecting people who want to teach with people who want to learn.

The platform promotes:

- Knowledge sharing
- Skill development
- Community collaboration
- Peer-to-peer learning
- Meaningful networking

---

## 👨‍💻 Developer

**Naman Gupta**

B.Tech Computer Science & Engineering

GitHub: [@Naman-1906](https://github.com/Naman-1906)

---

<p align="center">
  <strong>Made with 💜 for a community that loves learning.</strong>
  <br/>
  <sub>SkillSwap · Learn. Share. Connect.</sub>
</p>
