const mongoose = require('mongoose');
const { MONGODB_URI } = require('../env');

let connected = false;
async function connectMongo() {
  if (connected) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI, { autoIndex: true });
  connected = true;
  console.log('[mongo] connected');
}
module.exports = { connectMongo };
