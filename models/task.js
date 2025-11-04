// Load required packages
const { type } = require('express/lib/response');
const mongoose = require('mongoose');

// Define our user schema
var TaskSchema = new mongoose.Schema({
    name:               { type: String, required: [true, 'Task name is required'], trim: true },
    description:        { type: String, default: '', trim: true },
    deadline:           { type: Date, required: [true, 'Task deadline is required'] },
    completed:          { type: Boolean, default: false },
    assignedUser:       { type: String, default: "" },
    assignedUserName:   { type: String, default: 'unassigned', trim: true },
    dateCreated:        { type: Date, default: Date.now, immutable: true }
});


// Export the Mongoose model
module.exports = mongoose.model('Task', TaskSchema);
