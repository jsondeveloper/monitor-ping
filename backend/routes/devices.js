
const express = require('express');
const router = express.Router();
const Device = require('../models/Device');

router.get('/', async (req, res) => {
  const devices = await Device.find();
  res.json(devices);
});

router.post('/', async (req, res) => {
  try {
    const { ip } = req.body;
    const exists = await Device.findOne({ ip });
    if (!exists) {
      const newDevice = new Device({ ip });
      await newDevice.save();
    }
    res.status(201).json({ message: 'Device added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
