// Load required packages
const { type } = require('express/lib/response');
var mongoose = require('mongoose');

// Define our user schema
var TaskSchema = new mongoose.Schema({
    name:               { type: String, required: true, trim: true },
    description:        { type: String, default: '', trim: true },
    deadline:           { type: Date, required: true },
    completed:          { type: Boolean, default: false },
    assignedUser:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedUserName:   { type: String, default: 'unassigned', trim: true },
    dateCreated:        { type: Date, default: Date.now, immutable: true }
});


// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
