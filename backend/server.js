const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const tcpp = require('tcp-ping');
const ping = require('ping'); // ICMP
const bcrypt = require('bcryptjs');  // Para encriptar contraseñas
const jwt = require('jsonwebtoken'); // Para generar JWT

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
  port: { type: Number, default: 80 },
  alive: Boolean,
  method: { type: String, enum: ['TCP', 'ICMP'], default: 'TCP' },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
}, {
  versionKey: false // Esto deshabilita el campo `__v`
});

const Device = mongoose.model('Device', deviceSchema);

// Esquema de usuario
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' }
}, {
  versionKey: false // Esto deshabilita el campo `__v`
});

const User = mongoose.model('User', userSchema);

// Función combinada TCP + ICMP
async function pingDevice(ip, port = 80) {
  return new Promise((resolve) => {
    tcpp.probe(ip, port, async (err, aliveTCP) => {
      if (err || !aliveTCP) {
        // Si TCP falla, prueba con ICMP
        const res = await ping.promise.probe(ip);
        resolve({ ip, port, alive: res.alive, method: 'ICMP' });
      } else {
        resolve({ ip, port, alive: true, method: 'TCP' });
      }
    });
  });
}

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) return res.status(403).json({ error: 'Acceso denegado' });

  jwt.verify(token, 'SECRET_KEY', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token no válido' });
    req.user = user;
    next();
  });
};

// Rutas de autenticación
app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({ username, password: hashedPassword, role });

  try {
    await user.save();
    res.status(201).json({ message: 'Usuario registrado' });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error al registrar el usuario', details: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ username: user.username, role: user.role }, 'SECRET_KEY', { expiresIn: '1h' });

  res.json({ token });
});

// Rutas protegidas solo para admin
app.get('/admin/devices', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso solo para administradores' });

  try {
    const devices = await Device.find().populate('parent', 'ip name');
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

// Rutas de dispositivos (sin cambios)
app.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find().populate('parent', 'ip name');
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

app.post('/devices', async (req, res) => {
  const { ip, name, type, port = 80, parent } = req.body;

  const existingDevice = await Device.findOne({ ip });
  if (existingDevice) {
    return res.status(400).json({ error: 'Dispositivo con esta IP ya existe' });
  }

  const device = new Device({
    ip,
    name,
    type,
    port,
    alive: null,
    parent: parent || null,
  });

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

app.put('/devices/:ip', async (req, res) => {
  const { ip } = req.params;

  const updates = req.body;

  // Opcional: restringir campos permitidos
  const allowedFields = ['name', 'type', 'port', 'parent'];
  const updateData = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  }

  try {
    const updated = await Device.findOneAndUpdate({ ip }, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar dispositivo', details: err.message });
  }
});


app.post('/ping', async (req, res) => {
  const { devices } = req.body;

  const pingResults = await Promise.all(devices.map(async (ip) => {
    const device = await Device.findOne({ ip });
    if (!device) return { ip, alive: false };

    return await pingDevice(ip, device.port || 80);
  }));

  for (let result of pingResults) {
    await Device.updateOne({ ip: result.ip }, { alive: result.alive, method: result.method });
  }

  res.json(pingResults);
});

// Actualización automática cada minuto
const updateDevicesStatus = async () => {
  const devices = await Device.find();

  const pingResults = await Promise.all(devices.map(device => {
    return pingDevice(device.ip, device.port || 80);
  }));

  for (let result of pingResults) {
    await Device.updateOne({ ip: result.ip }, { alive: result.alive, method: result.method });
  }

  console.log('Dispositivos actualizados');
};

setInterval(updateDevicesStatus, 60000);

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
