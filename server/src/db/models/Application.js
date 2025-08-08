const { Schema, model, Types } = require('mongoose');
const statuses = ['APPLIED','ASSESSMENT','INTERVIEW','OFFER','REJECTED'];

const ApplicationSchema = new Schema({
  userId:     { type: Types.ObjectId, ref: 'User', index: true, required: true },
  messageId:  { type: String, unique: true, required: true, index: true },
  threadId:   String,
  jobTitle:   { type: String, required: true },
  company:    { type: String, required: true },
  platform:   String,
  dateApplied:{ type: Date, required: true },
  status:     { type: String, enum: statuses, default: 'APPLIED', index: true },
  notes:      { type: String, default: '' }, // New notes field
  rawSnippet: String,
}, { timestamps: true });

module.exports = model('Application', ApplicationSchema);
module.exports.statuses = statuses;