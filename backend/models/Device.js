
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Device', deviceSchema);
