// Load required packages
const { type } = require('express/lib/response');
const mongoose = require('mongoose');

// Define our user schema
var UserSchema = new mongoose.Schema({
    name:           { type: String, required: [true, "user name is required"], trim: true },
    email:          { type: String, required: [true, "user email is required"], trim: true, unique: true, match: [/.+@.+\..+/, "Please enter a valid email address"] },
    pendingTasks:   [{ type: String }],
    dateCreated:    { type: Date, default: Date.now, immutable: true }
});

UserSchema.index( {email: 1}, { unique: true });

// Export the Mongoose model
const User = mongoose.model("User", UserSchema);
module.exports = User;
