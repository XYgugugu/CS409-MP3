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
    const usersIdRoute = router.route('/users/:id');
    
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

    usersIdRoute.put(async (req, res) => {
        try {
            const userId = req.params.id;
            const { name, email, pendingTasks } = req.body;

            if (!mongoose.isValidObjectId(userId)) {
                return res.status(400).json({ message: 'BAD REQUEST: invalid user ID', data: {} });
            }

            const prev = await User.findById(userId);
            if (!prev) {
                return res.status(404).json({ message: 'NOT FOUND: user not found', data: {} });
            }

            if (!name || !email) {
                return res.status(400).json({ message: 'BAD REQUEST: name and email are required to PUT user', data: {} });
            }

            const emailInUse = await User.findOne({ email: email.trim(), _id: { $ne: userId } });
            if (emailInUse) {
                return res.status(400).json({ message: "BAD REQUEST: email must be unique to PUT user", data: {} });
            }

            const newPending = Array.isArray(pendingTasks) ? pendingTasks : [];
            for (const taskId of newPending) {
                if (!mongoose.isValidObjectId(taskId)) {
                    return res.status(400).json({ message: 'BAD REQUEST: invalid task id in input pendingTasks', data: {} });
                }
                const t = await Task.findById(taskId).select('completed');
                if (!t) {
                    return res.status(404).json({ message: 'NOT FOUND: task in input pendingTasks not found', data: {} });
                }
                if (t.completed === true) {
                    return res.status(400).json({ message: 'BAD REQUEST: completed tasks cannot be in input pendingTasks', data: {} });
                }
            }

            const oldSet = new Set((prev.pendingTasks || []).map(String));
            const newSet = new Set(newPending.map(String));
            const toUnassign = [...oldSet].filter(x => !newSet.has(x));
            const toAssign = [...newSet].filter(x => !oldSet.has(x));

            if (toUnassign.length) {
                await Task.updateMany(
                    { _id: { $in: toUnassign }, assignedUser: userId },
                    { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
                );
            }

            if (toAssign.length) {
                await User.updateMany(
                    { _id: { $ne: userId }, pendingTasks: { $in: toAssign } },
                    { $pull: { pendingTasks: { $in: toAssign } } }
                );
            }

            for (const tid of toAssign) {
                await Task.updateOne({ _id: tid }, { $set: { assignedUser: userId, assignedUserName: String(name).trim() } });
            }

            const u = await User.findOneAndReplace(
                { _id: userId },
                {
                    name: String(name).trim(),
                    email: String(email).trim(),
                    pendingTasks: [...new Set(newPending.map(String))],
                    dateCreated: prev.dateCreated
                },
                { new: true, runValidators: true }
            );

            return res.status(200).json({ message: 'OK', data: u });

        } catch (e) {
            if (e.name === 'ValidationError') {
                return res.status(400).json({ message: 'BAD REQUEST: invalid user payload', data: {} });
            }
            return res.status(500).json({ message: 'SERVER ERROR: unable to update user', data: {} });
        }
    });


    return router;
};