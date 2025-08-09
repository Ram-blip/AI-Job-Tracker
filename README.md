<img width="1470" height="878" alt="Screenshot 2025-08-08 at 4 57 56 PM" src="https://github.com/user-attachments/assets/3bc79971-e158-4b26-acba-75df5a302a3b" />

# 📨 AI Job Tracker

AI Job Tracker is a full-stack app that automatically scans your Gmail for job application confirmation emails, extracts key details using **Google Gemini AI**, and stores them in a searchable dashboard.

## 🚀 Features
- Google OAuth for secure Gmail access  
- Intelligent Gmail API filters for ATS emails (Workday, Greenhouse, Lever, etc.)  
- AI-powered extraction of job title, company, platform, and date applied  
- Noise filtering to skip non-job emails  
- MongoDB storage + React dashboard  

## 🏗️ Tech Stack
**Frontend:** React, Axios  
**Backend:** Node.js, Express, MongoDB, Gmail API, Google Gemini API  

## ⚙️ Setup
```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/job-tracker.git
cd job-tracker

# 2. Install backend dependencies
cd server
npm install

# 3. Install frontend dependencies
cd ../client
npm install

# 4. Create and update your environment variables
#    Add your MongoDB URI, Gmail API credentials, and Gemini API key in .env files

# 5. Run the app
npm run dev
