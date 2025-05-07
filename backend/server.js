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

}).then(() => {
  console.log('Conectado a MongoDB');
}).catch((err) => {
  console.log('Error al conectar a MongoDB:', err);
});

// Esquema del dispositivo
const deviceSchema = new mongoose.Schema({
  ip: { type: String, required: true },
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

  try {
    // Verifica si ya existe un dispositivo con la misma IP y puerto
    const existingDevice = await Device.findOne({ ip, port });
    if (existingDevice) {
      return res.status(400).json({ error: 'Dispositivo con esta IP y puerto ya existe' });
    }

    const device = new Device({
      ip,
      name,
      type,
      port,
      alive: null,
      parent: parent || null,
    });

    await device.save();
    res.json(device);
  } catch (err) {
    console.error('Error en el servidor:', err);
    res.status(500).json({ error: 'Error al agregar dispositivo', details: err.message });
  }
});



app.delete('/devices/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await Device.findByIdAndDelete(id);
    res.json({ message: 'Dispositivo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar dispositivo' });
  }
});


app.put('/devices/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = ['name', 'type', 'ip', 'port', 'parent'];
  const updateData = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  }

  try {
    const updated = await Device.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar dispositivo', details: err.message });
  }
});



app.post('/ping', async (req, res) => {
  const limit = (await import('p-limit')).default;
  const limiter = limit(30);

  const { devices } = req.body;

  const pingResults = await Promise.all(devices.map(ip =>
    limiter(async () => {
      const device = await Device.findOne({ ip });
      if (!device) return { ip, alive: false };
      return await pingDevice(ip, device.port || 80);
    })
  ));

  for (let result of pingResults) {
    await Device.updateOne({ ip: result.ip }, { alive: result.alive, method: result.method });
  }

  res.json(pingResults);
});

const updateDevicesStatus = async () => {
  const limit = (await import('p-limit')).default;
  const limiter = limit(30); // Limita el número de solicitudes paralelas

  const devices = await Device.find(); // Obtener todos los dispositivos

  // Agrupa dispositivos por combinación de IP y Puerto
  const devicesByIpPort = devices.reduce((acc, device) => {
    const key = `${device.ip}:${device.port}`; // Combina IP y puerto
    if (!acc[key]) acc[key] = [];
    acc[key].push(device);
    return acc;
  }, {});

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Ejecuta el ping para cada grupo de IP:Puerto
  const results = await Promise.all(
    Object.entries(devicesByIpPort).map(([ipPortKey, devicesForIpPort]) =>
      limiter(async () => {
        const [ip, port] = ipPortKey.split(':'); // Separa IP y puerto
        console.log(`Haciendo ping a IP: ${ip} y Puerto: ${port}`); // Verifica cuál IP:Puerto se está procesando

        const resultsForIpPort = [];

        for (const device of devicesForIpPort) {
          const result = await pingDevice(ip, port);
          console.log(`Resultado de ping para ${ip}:${port}:`, result); // Registra el resultado del ping

          resultsForIpPort.push(result);

          // Espera 200 ms entre los pings a la misma IP:Puerto
          await sleep(200);
        }

        return resultsForIpPort;
      })
    )
  );

  // Aplana los resultados
  const flatResults = results.flat();

  // Actualiza el estado de cada dispositivo
  for (let result of flatResults) {
    console.log(`Actualizando dispositivo: ${result.ip}:${result.port} con estado ${result.alive ? 'ALIVE' : 'DOWN'}`); // Verifica el dispositivo que se actualiza
    await Device.updateOne(
      { ip: result.ip, port: result.port },
      { alive: result.alive, method: result.method }
    );
  }

  console.log('Actualización de dispositivos completada');
};

// Llamada periódica cada 60 segundos
setInterval(updateDevicesStatus, 60000);


// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
