const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  googleId: { type: String, unique: true, required: true, index: true },
  email:    { type: String, unique: true, required: true, index: true },
  name:     String,
  picture:  String,
  accessToken:  String,
  refreshToken: String,
  tokenExpiry:  Date,
}, { timestamps: true });

module.exports = model('User', UserSchema);
