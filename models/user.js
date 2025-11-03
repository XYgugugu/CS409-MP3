// Load required packages
const { type } = require('express/lib/response');
var mongoose = require('mongoose');

// Define our user schema
var UserSchema = new mongoose.Schema({
    name:           { type: String, required: true, trim: true },
    email:          { type: String, required: true, trim: true, index: true },
    pendingTasks:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    dateCreated:    { type: Date, default: Date.now, immutable: true }
});

UserSchema.index( {email: 1}, { unique: true});

// Export the Mongoose model
module.exports = mongoose.model('User', UserSchema);
