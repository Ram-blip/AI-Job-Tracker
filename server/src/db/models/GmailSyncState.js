const { Schema, model, Types } = require('mongoose');

const GmailSyncStateSchema = new Schema({
  userId:        { type: Types.ObjectId, ref: 'User', unique: true, required: true, index: true },
  lastHistoryId: String,
  lastFetchedAt: Date,
}, { timestamps: true });

module.exports = model('GmailSyncState', GmailSyncStateSchema);
