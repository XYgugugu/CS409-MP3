const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/user');
const Task = require('../models/task');

const parseJSON = (v, name) => (v === undefined ? undefined : (() => { try { return JSON.parse(v); } catch { throw new Error(`Invalid JSON in "${name}"`); } })());
const buildQuery = (q, defaultLimit=0) => ({
  where:  parseJSON(q.where, 'where')  || {},
  sort:   parseJSON(q.sort, 'sort')    || {},
  select: parseJSON(q.select, 'select')|| {},
  skip:   q.skip ? parseInt(q.skip,10) : 0,
  limit:  q.limit!==undefined ? parseInt(q.limit,10) : defaultLimit,
  count:  q.count==='true' || q.count===true,
});

module.exports = function (router) {
    const usersRoute = router.route('/users');
    
    usersRoute.post(async (req, res) => {
        try {
            const { name, email, pendingTasks } = req.body;
            if ( !name || !email ) {
                return res.status(400).json({
                    message: "BAD REQUEST: name and email are required to POST user", 
                    data: {}
                });
            }
            const pending = Array.isArray(pendingTasks) ? pendingTasks : [];
            for (const taskId of pending) {
                if (!mongoose.isValidObjectId(taskId)) {
                    return res.status(400).json({
                        message: "BAD REQUEST: invalid task id in pendingTasks",
                        data: {}
                    });
                }

                const taskProfile = await Task.findById(taskId).select("completed");
                if (!taskProfile) {
                    return res.status(404).json({
                        message: "NOT FOUND: task in pendingTasks not found",
                        data: {}
                    });
                }
                if (taskProfile.completed === true) {
                    return res.status(400).json({
                        message: "BAD REQUEST: completed tasks cannot be in pendingTasks",
                        data: {}
                    });
                }
            }

            const u = await User.create({ 
                name: String(name).trim(), 
                email: String(email).trim(), 
                pendingTasks: pending 
            });
            return res.status(201).json({message: "OK", data: u});
        } catch (e) {
            if (e.code === 11000) {
                return res.status(400).json({
                    message: "BAD REQUEST: email must be unique to POST user", 
                    data: {}
                });
            }
            if (e.name === 'ValidationError') {
                return res.status(400).json({
                message: "BAD REQUEST: invalid user payload",
                data: {}
                });
            }
            return res.status(500).json({
                message: "SERVER ERROR: unable to create user",
                data: {}
            });
        }
    });

    return router;
};