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
    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');

    tasksRoute.post(async (req, res) => {
        try {
            const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;
            if (!name || !deadline) {
                return res.status(400).json({
                    message: 'BAD REQUEST: name and deadline are required to POST task',
                    data: {}
                });
            }

            const deadlineDate = new Date(deadline);
            if (Number.isNaN(deadlineDate.getTime())) {
                return res.status(400).json({ 
                    message: 'BAD REQUEST: invalid deadline', 
                    data: {} 
                });
            }

            const completedBool = completed === true || String(completed).toLowerCase().trim() === 'true';

            let resolvedAssignedUser = "";
            let resolvedAssignedUserName = "unassigned";
            const assignedUserStr = (typeof assignedUser === 'string' ? assignedUser.trim() : '');
            if (assignedUserStr !== '') {
                if (!mongoose.isValidObjectId(assignedUserStr)) {
                    return res.status(400).json({ message: 'BAD REQUEST: invalid assignedUser id', data: {} });
                }
                const userProfile = await User.findById(assignedUserStr).select('name');
                if (!userProfile) {
                    return res.status(404).json({ message: 'NOT FOUND: assignedUser not found', data: {} });
                }
                if (assignedUserName == null) {
                    resolvedAssignedUserName = userProfile.name;
                } else {
                    if (String(assignedUserName).trim() !== userProfile.name) {
                        return res.status(400).json({
                            message: 'BAD REQUEST: assignedUserName does not match user name',
                            data: {}
                        });
                    }
                    resolvedAssignedUserName = userProfile.name;
                }
                resolvedAssignedUser = assignedUserStr
            }
            if (completedBool && assignedUserStr !== '') {
                return res.status(400).json({message: 'BAD REQUEST: completed tasks cannot be assigned to a user', data: {}});
            }
            const t = await Task.create({
                name: String(name).trim(),
                description: typeof description === 'string' ? description : '',
                deadline: deadlineDate,
                completed: completedBool,
                assignedUser: resolvedAssignedUser,
                assignedUserName: resolvedAssignedUserName
            });

            return res.status(201).json({ message: "OK", data: t});
        } catch (e) {
            if (e.name === 'ValidationError') {
                return res.status(400).json({
                message: "BAD REQUEST: invalid task payload",
                data: {}
                });
            }
            return res.status(500).json({
                message: "SERVER ERROR: unable to create task",
                data: {}
            });
        }
    });

    tasksRoute.get(async (req, res) => {
        try {
            let q;
            try {
                q = buildQuery(req.query, 0);
            } catch {
                return res.status(400).json({ message: 'BAD REQUEST: invalid query parameters', data: {} });
            }
            const { where, sort, select, skip, limit, count } = q;
            if (count) {
                const c = await Task.countDocuments(where);
                return res.status(200).json({ message: 'OK', data: { count: c } });
            }
            const docs = await Task.find(where).sort(sort).select(select).skip(skip).limit(limit);
            return res.status(200).json({ message: 'OK', data: docs });
        } catch {
            return res.status(500).json({ message: 'SERVER ERROR: unable to fetch tasks', data: {} });
        }
    });

    tasksIdRoute.put(async (req, res) => {
        try {
            const taskId = req.params.id;
            const { name, description, deadline, completed, assignedUser, assignedUserName } = req.body;

            if (!mongoose.isValidObjectId(taskId)) {
                return res.status(400).json({ message: 'BAD REQUEST: invalid task ID', data: {} });
            }
            const prev = await Task.findById(taskId);
            if (!prev) {
                return res.status(404).json({ message: 'NOT FOUND: task not found', data: {} });
            }

            if (!name || !deadline) {
                return res.status(400).json({
                    message: 'BAD REQUEST: name and deadline are required to PUT task',
                    data: {},
                });
            }

            const deadlineDate = new Date(deadline);
            if (Number.isNaN(deadlineDate.getTime())) {
                return res.status(400).json({
                    message: 'BAD REQUEST: invalid deadline date',
                    data: {},
                });
            }

            const completedBool = completed === true || String(completed).toLowerCase().trim() === 'true';

            let resolvedAssignedUser = "";
            let resolvedAssignedUserName = "unassigned";
            const assignedUserStr = (typeof assignedUser === 'string' ? assignedUser.trim() : '');
            if (assignedUserStr !== '') {
                if (!mongoose.isValidObjectId(assignedUserStr)) {
                    return res.status(400).json({ message: 'BAD REQUEST: invalid assignedUser id', data: {} });
                }
                const userProfile = await User.findById(assignedUserStr).select('name');
                if (!userProfile) {
                    return res.status(404).json({ message: 'NOT FOUND: assignedUser not found', data: {} });
                }
                if (assignedUserName == null) {
                    resolvedAssignedUserName = userProfile.name;
                } else {
                    if (String(assignedUserName).trim() !== userProfile.name) {
                        return res.status(400).json({
                            message: 'BAD REQUEST: assignedUserName does not match user name',
                            data: {}
                        });
                    }
                    resolvedAssignedUserName = userProfile.name;
                }
                resolvedAssignedUser = assignedUserStr
            }
            if (completedBool && assignedUserStr !== '') {
                return res.status(400).json({message: 'BAD REQUEST: completed tasks cannot be assigned to a user', data: {}});
            }

            if (completedBool || resolvedAssignedUser === '') {
                await User.updateMany(
                    { pendingTasks: taskId },
                    { $pull: { pendingTasks: taskId } }
                );
            } else {
                await User.updateMany(
                    { _id: { $ne: resolvedAssignedUser }, pendingTasks: taskId },
                    { $pull: { pendingTasks: taskId } }
                );
                await User.updateOne(
                    { _id: resolvedAssignedUser },
                    { $addToSet: { pendingTasks: taskId } }
                );
            }

            const t = await Task.findOneAndReplace(
                { _id: taskId },
                {
                    name: String(name).trim(),
                    description: typeof description === 'string' ? description : '',
                    deadline: deadlineDate,
                    completed: completedBool,
                    assignedUser: resolvedAssignedUser,
                    assignedUserName: resolvedAssignedUserName,
                    dateCreated: prev.dateCreated
                },
                { new: true, runValidators: true }
            );

            return res.status(200).json({ message: 'OK', data: t });
        } catch (e) {
            if (e.name === 'ValidationError') {
            return res.status(400).json({ message: 'BAD REQUEST: invalid task payload', data: {} });
            }
            return res.status(500).json({ message: 'SERVER ERROR: unable to update task', data: {} });
        }
    });

    tasksIdRoute.delete(async (req, res) => {
        try {
            const taskId = req.params.id;
            if (!mongoose.isValidObjectId(taskId)) {
                return res.status(400).json({ message: 'BAD REQUEST: invalid task ID', data: {} });
            }
            const exists = await Task.exists({ _id: taskId });
            if (!exists) {
                return res.status(404).json({ message: 'NOT FOUND: task not found', data: {} });
            }
            const taskIdStr = String(taskId);
            await User.updateMany(
                { pendingTasks: taskIdStr },
                { $pull: { pendingTasks: taskIdStr } }
            );
            await Task.deleteOne({ _id: taskId });
            return res.status(204).end();
        } catch (e) {
            return res.status(500).json({ message: 'SERVER ERROR: unable to delete task', data: {} });
        }
    });

    router.get('/tasks/:id', async (req, res) => {
        try {
            const taskId = req.params.id;
            if (!mongoose.isValidObjectId(taskId)) {
                return res.status(400).json({ message: 'BAD REQUEST: invalid task ID', data: {} });
            }
            let select = {};
            if (req.query.select !== undefined) {
                try {
                    select = JSON.parse(req.query.select);
                } catch {
                    return res.status(400).json({ message: "BAD REQUEST: invalid JSON in 'select'", data: {} });
                }
            }
            const doc = await Task.findById(taskId).select(select);
            if (!doc) {
                return res.status(404).json({ message: 'NOT FOUND: task not found', data: {} });
            }
            return res.status(200).json({ message: 'OK', data: doc });
        } catch {
            return res.status(500).json({ message: 'SERVER ERROR: unable to fetch task', data: {} });
        }
    });
    return router;
};