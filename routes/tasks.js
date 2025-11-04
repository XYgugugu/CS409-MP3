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

    return router;
};