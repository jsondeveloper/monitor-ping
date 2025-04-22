const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ping = require('ping');

// Configuración de Express
const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect('mongodb+srv://jeissonetworks:iivf4eZ0tKEYaY2v@monitorping.a2sqryl.mongodb.net/?retryWrites=true&w=majority&appName=MonitorPing', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((err) => {
  console.log('Error al conectar a MongoDB:', err);
});

// Esquema del dispositivo
const deviceSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },
  name: String,
  type: { type: String, enum: ['antena', 'router', 'server'], required: true },
  alive: Boolean,
});

const Device = mongoose.model('Device', deviceSchema);

// Rutas
app.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

app.post('/devices', async (req, res) => {
  const { ip, name, type } = req.body;

  // Verificar si el dispositivo con la misma IP ya existe
  const existingDevice = await Device.findOne({ ip });
  if (existingDevice) {
    return res.status(400).json({ error: 'Dispositivo con esta IP ya existe' });
  }

  // Crear y guardar el nuevo dispositivo
  const device = new Device({ ip, name, type, alive: null });
  try {
    await device.save();
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar dispositivo' });
  }
});

app.delete('/devices/:ip', async (req, res) => {
  const { ip } = req.params;

  try {
    await Device.deleteOne({ ip });
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dispositivo' });
  }
});

// Ruta para hacer ping a los dispositivos de forma real
app.post('/ping', async (req, res) => {
  const { devices } = req.body;

  // Realizar ping real a cada dispositivo usando el paquete 'ping'
  const pingResults = await Promise.all(devices.map(async (ip) => {
    try {
      const { alive } = await ping.promise.probe(ip);
      return { ip, alive };
    } catch (err) {
      console.error('Error al hacer ping a', ip, err);
      return { ip, alive: false }; // Si ocurre un error, marcar como inactivo
    }
  }));

  // Actualizar el estado de cada dispositivo
  for (let i = 0; i < pingResults.length; i++) {
    const result = pingResults[i];
    await Device.updateOne({ ip: result.ip }, { alive: result.alive });
  }

  res.json(pingResults);
});

// Función para actualizar los estados de los dispositivos cada minuto
const updateDevicesStatus = async () => {
  const devices = await Device.find();
  const ips = devices.map(device => device.ip);

  // Hacer ping a los dispositivos
  const pingResults = await Promise.all(ips.map(async (ip) => {
    try {
      const { alive } = await ping.promise.probe(ip);
      return { ip, alive };
    } catch (err) {
      console.error('Error al hacer ping a', ip, err);
      return { ip, alive: false }; // Si ocurre un error, marcar como inactivo
    }
  }));

  // Actualizar el estado de cada dispositivo en la base de datos
  for (let i = 0; i < pingResults.length; i++) {
    const result = pingResults[i];
    await Device.updateOne({ ip: result.ip }, { alive: result.alive });
  }

  console.log('Dispositivos actualizados');
};

// Iniciar el intervalo para actualizar los dispositivos cada minuto
setInterval(updateDevicesStatus, 60000); // 60000 ms = 1 minuto

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
