import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [ipInput, setIpInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('router');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);  // Estado de carga
  const [message, setMessage] = useState('');  // Mensaje de error o éxito
  const [activeTab, setActiveTab] = useState('');  // Estado para la pestaña activa

  // Validación básica de IP
  const isValidIP = (ip) => {
    const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  };

  // Llamar al backend para obtener dispositivos
  const fetchDevices = async () => {
    setLoading(true); // Activar carga mientras obtenemos los dispositivos
    try {
      const res = await axios.get('http://localhost:3001/devices');
      setDevices(res.data);
      pingAll(res.data.map(d => d.ip));  // Hacer ping a todos los dispositivos
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false); // Desactivar carga una vez que se obtienen los dispositivos
    }
  };

  // Agregar un dispositivo
  const addDevice = async () => {
    if (!isValidIP(ipInput)) {
      setMessage('Por favor, ingresa una IP válida');
      return;
    }

    try {
      await axios.post('http://localhost:3001/devices', {
        ip: ipInput.trim(),
        name: nameInput.trim(),
        type: typeInput
      });
      setMessage('Dispositivo agregado con éxito!');
      setIpInput('');
      setNameInput('');
      setTypeInput('router');
      fetchDevices();  // Volver a obtener la lista de dispositivos
    } catch (err) {
      setMessage('Error al agregar dispositivo.');
      console.error('Error adding device:', err);
    }
  };

  // Eliminar un dispositivo
  const deleteDevice = async (ip) => {
    try {
      await axios.delete(`http://localhost:3001/devices/${ip}`);
      fetchDevices();  // Actualizar la lista de dispositivos después de eliminar uno
    } catch (err) {
      console.error('Error deleting device:', err);
    }
  };

  // Hacer ping a todos los dispositivos
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

  // Obtener imagen según el tipo de dispositivo
  const getDeviceImage = (type) => {
    const deviceImages = {
      router: '/images/router.png',
      antena: '/images/antena.png',
      server: '/images/server.png',
      default: '/images/default.png',
    };
    return deviceImages[type] || deviceImages.default;
  };

  // Función para manejar la actualización manual de dispositivos
  const handleUpdateDevices = () => {
    const ips = devices.map(d => d.ip);  // Obtener las IPs de todos los dispositivos
    pingAll(ips);  // Llamar a la función pingAll
  };

  // Agrupar los dispositivos por el segmento de IP
  const groupDevicesBySegment = () => {
    const groups = devices.reduce((acc, device) => {
      const segment = device.ip.split('.').slice(0, 3).join('.');  // Obtener el segmento de IP
      if (!acc[segment]) {
        acc[segment] = [];
      }
      acc[segment].push(device);
      return acc;
    }, {});

    return groups;
  };

  // Cambiar de pestaña
  const handleTabChange = (segment) => {
    setActiveTab(segment);
  };

  useEffect(() => {
    fetchDevices();  // Llamar al inicio para obtener los dispositivos
    const interval = setInterval(() => fetchDevices(), 60000);  // Actualizar cada 60 segundos
    return () => clearInterval(interval);  // Limpiar intervalo al desmontar el componente
  }, []);

  const deviceGroups = groupDevicesBySegment();

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

      {message && <p>{message}</p>}

      <div>
        {/* Pestañas para cada segmento de IP */}
        {Object.keys(deviceGroups).map(segment => (
          <button
            key={segment}
            onClick={() => handleTabChange(segment)}
            style={{
              margin: 5,
              padding: 10,
              backgroundColor: activeTab === segment ? '#007bff' : '#ddd',
              color: activeTab === segment ? '#fff' : '#000',
              borderRadius: 5
            }}
          >
            {segment}
          </button>
        ))}
      </div>

      {/* Mostrar dispositivos según la pestaña activa */}
      <div>
        {activeTab && deviceGroups[activeTab] && (
          <ul>
            {deviceGroups[activeTab].map((d) => (
              <li key={d.ip} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <img src={getDeviceImage(d.type)} alt={d.type} style={{ width: 30, height: 30, marginRight: 10 }} />
                <span> {d.name} — {d.ip} — {d.alive == null ? '⏳' : d.alive ? '🟢 Activo' : '🔴 Inactivo'} </span>
                <button onClick={() => deleteDevice(d.ip)} style={{ marginLeft: 10 }}>❌ Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <p>🕒 Actualizando estado de dispositivos...</p>}

      {/* Botón para actualizar manualmente los dispositivos */}
      <button onClick={handleUpdateDevices}>Actualizar Todos</button>
    </div>
  );
}

export default App;
