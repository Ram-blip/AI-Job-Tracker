require('dotenv').config();
function required(k){ const v = process.env[k]; if(!v) throw new Error(`Missing env ${k}`); return v; }
module.exports = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  CLIENT_URL: required('CLIENT_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: required('GOOGLE_CLIENT_SECRET'),
  GOOGLE_REDIRECT_URI: required('GOOGLE_REDIRECT_URI'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  MONGODB_URI: required('MONGODB_URI'),
};

