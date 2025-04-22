import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [ipInput, setIpInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('router');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);  // Estado de carga

  const fetchDevices = async () => {
    try {
      const res = await axios.get('http://localhost:3001/devices');
      setDevices(res.data);
      pingAll(res.data.map(d => d.ip));  // Hacer ping a todos los dispositivos
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const addDevice = async () => {
    try {
      await axios.post('http://localhost:3001/devices', {
        ip: ipInput.trim(),
        name: nameInput.trim(),
        type: typeInput
      });
      setIpInput('');
      setNameInput('');
      setTypeInput('router');
      fetchDevices();  // Volver a obtener la lista de dispositivos
    } catch (err) {
      console.error('Error adding device:', err);
    }
  };

  const deleteDevice = async (ip) => {
    try {
      await axios.delete(`http://localhost:3001/devices/${ip}`);
      fetchDevices();  // Actualizar la lista de dispositivos después de eliminar uno
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  const pingAll = async (ips) => {
    setLoading(true);  // Activar el estado de carga mientras se hace el ping
    try {
      const res = await axios.post('http://localhost:3001/ping', { devices: ips });
      setDevices(devices =>
        devices.map(dev => {
          const found = res.data.find(d => d.ip === dev.ip);
          return found ? { ...dev, alive: found.alive } : dev;
        })
      );
    } catch (err) {
      console.error('Error pinging devices:', err);
    } finally {
      setLoading(false);  // Desactivar el estado de carga una vez terminado el ping
    }
  };

  const getDeviceImage = (type) => {
    switch (type) {
      case 'router':
        return '/images/router.png';
      case 'antena':
        return '/images/antena.png';
      case 'server':
        return '/images/server.png';
      default:
        return '/images/default.png';
    }
  };

  // Función para manejar la actualización manual de dispositivos
  const handleUpdateDevices = () => {
    const ips = devices.map(d => d.ip);  // Obtener las IPs de todos los dispositivos
    pingAll(ips);  // Llamar a la función pingAll
  };

  useEffect(() => {
    fetchDevices();  // Llamar al inicio para obtener los dispositivos
    const interval = setInterval(() => fetchDevices(), 20000);  // Actualizar cada 20 segundos
    return () => clearInterval(interval);  // Limpiar intervalo al desmontar el componente
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Monitor de Dispositivos</h1>
      <div style={{ marginBottom: 10 }}>
        <input
          value={ipInput}
          onChange={(e) => setIpInput(e.target.value)}
          placeholder="Ingresa IP"
        />
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Ingresa Nombre del Dispositivo"
        />
        <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)}>
          <option value="router">Router</option>
          <option value="antena">Antena</option>
          <option value="server">Server</option>
        </select>
        <button onClick={addDevice}>Agregar</button>
      </div>
      <ul>
        {devices.map((d) => (
          <li key={d.ip} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <img src={getDeviceImage(d.type)} alt={d.type} style={{ width: 30, height: 30, marginRight: 10 }} />
            <span>{d.name || d.ip} — {d.alive == null ? '⏳' : d.alive ? '🟢 Activo' : '🔴 Inactivo'}</span>
            <button onClick={() => deleteDevice(d.ip)} style={{ marginLeft: 10 }}>❌ Eliminar</button>
          </li>
        ))}
      </ul>
      {loading && <p>🕒 Actualizando estado de dispositivos...</p>}

      {/* Botón para actualizar manualmente los dispositivos */}
      <button onClick={handleUpdateDevices} style={{ marginTop: '20px' }}>
        🟢 Actualizar ahora
      </button>
    </div>
  );
}

export default App;
