import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [ipInput, setIpInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [typeInput, setTypeInput] = useState('router');
  const [parentInput, setParentInput] = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('');

  const isValidIP = (ip) => {
    const regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  };

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3001/devices');
      setDevices(res.data);
      pingAll(res.data.map((d) => d.ip));
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const addDevice = async () => {
    if (!isValidIP(ipInput)) {
      setMessage('IP no válida');
      return;
    }

    try {
      await axios.post('http://localhost:3001/devices', {
        ip: ipInput,
        name: nameInput,
        type: typeInput,
        parent: parentInput || null,
      });
      setIpInput('');
      setNameInput('');
      setTypeInput('router');
      setParentInput('');
      setMessage('Dispositivo agregado exitosamente');
      fetchDevices();
    } catch (error) {
      console.error('Error al agregar dispositivo:', error);
      setMessage('Error al agregar dispositivo');
    }
  };

  const deleteDevice = async (ip) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este dispositivo?')) {
      try {
        await axios.delete(`http://localhost:3001/devices/${ip}`);
        fetchDevices();
      } catch (err) {
        console.error('Error deleting device:', err);
        setMessage('Error al eliminar dispositivo');
      }
    }
  };

  const pingAll = async (ips) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3001/ping', { devices: ips });
      setDevices((prev) =>
        prev.map((dev) => {
          const found = res.data.find((d) => d.ip === dev.ip);
          return found ? { ...dev, alive: found.alive } : dev;
        })
      );
    } catch (err) {
      console.error('Error pinging devices:', err);
      setMessage('Error al hacer ping a los dispositivos');
    } finally {
      setLoading(false);
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

  const handleUpdateDevices = () => {
    const ips = devices.map((d) => d.ip);
    pingAll(ips);
  };

  const groupDevicesBySegment = () => {
    const groups = devices.reduce((acc, device) => {
      const segment = device.ip.split('.').slice(0, 3).join('.');
      if (!acc[segment]) {
        acc[segment] = [];
      }
      acc[segment].push(device);
      return acc;
    }, {});
    return groups;
  };

  const handleTabChange = (segment) => {
    setActiveTab(segment);
  };

  // Mostrar jerarquía de dispositivos
  const DeviceTree = ({ devices, parentId = null, isRoot = true }) => {
    const children = devices.filter((device) => {
      const deviceParentId = device.parent?._id || null;
      return deviceParentId === parentId;
    });

    if (children.length === 0) return null;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          flexWrap: 'wrap',
        }}
      >
        {/* Horizontal para hijos si hay más de uno */}
        {children.length > 1 && (
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            {/* Línea horizontal que conecta a todos los hijos */}
            <div
              style={{
                position: 'absolute',
                top: -10,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: '#ccc',
                zIndex: -100,
              }}
            />

            {children.map((device) => {
              const hasChildren = devices.some((d) => (d.parent?._id || null) === device._id);
              return (
                <div key={device._id} style={{ margin: '0 20px', textAlign: 'center', position: 'relative',  backgroundColor: '#fff', 
                  borderRadius: 6,
                  zIndex: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',}}>
                  {/* Línea vertical que baja desde horizontal */}
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      width: 2,
                      height: 20,
                      backgroundColor: '#ccc',
                      transform: 'translateX(-50%)',
                      zIndex: -100,
                    }}
                  />
                  {/* Nodo */}
                  <DeviceNode device={device} />
                  {/* Render hijos */}
                  {hasChildren && (
                    <div style={{ marginTop: 20 }}>
                      <DeviceTree devices={devices} parentId={device._id} isRoot={false} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Caso: solo un hijo → mostrar vertical directo */}
        {children.length === 1 && (() => {
          const device = children[0];
          const hasChildren = devices.some((d) => (d.parent?._id || null) === device._id);
          return (
            <div style={{ textAlign: 'center', position: 'relative' }}>
              {/* Línea vertical desde el padre */}
              {!isRoot && (
                <div
                  style={{
                    position: 'absolute',
                    top: -30,
                    left: '50%',
                    width: 2,
                    height: 30,
                    backgroundColor: '#ccc',
                    transform: 'translateX(-50%)',
                    zIndex: -100,
                  }}
                />
              )}
              {/* Nodo */}
              <DeviceNode device={device} />
              {/* Hijos */}
              {hasChildren && (
                <div style={{ marginTop: 20 }}>
                  <DeviceTree devices={devices} parentId={device._id} isRoot={false} />
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // Extraído para claridad
  const DeviceNode = ({ device }) => {
    const backgroundColor = device.alive ? '#e0fbe0' : '#fde0e0'; // Verde claro si alive, rojo claro si no

    return (
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          border: '1px solid #ddd',
          borderRadius: 6,
          padding: 10,
          backgroundColor,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          minWidth: 120,
        }}
      >
        <img src={getDeviceImage(device.type)} alt={device.type} style={{ width: 32, height: 32, marginBottom: 5 }} />
        <div>
          <strong>{device.name || 'Sin nombre'}</strong><br />
          {device.ip} {device.alive ? '🟢' : '🔴'}
        </div>
        <button onClick={() => deleteDevice(device.ip)} style={{ marginTop: 5 }}>
          Eliminar
        </button>
      </div>
    );
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  const deviceGroups = groupDevicesBySegment();
  const filteredDevices = activeTab
    ? devices.filter((d) => d.ip.startsWith(activeTab))
    : devices;

  return (
    <div style={{ padding: 20 }}>
      <h1>Monitor de Dispositivos</h1>

      <div style={{ marginBottom: 10 }}>
        <input
          value={ipInput}
          onChange={(e) => setIpInput(e.target.value)}
          placeholder="IP"
        />
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Nombre"
        />
        <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)}>
          <option value="router">Router</option>
          <option value="antena">Antena</option>
          <option value="server">Servidor</option>
        </select>
        <select value={parentInput} onChange={(e) => setParentInput(e.target.value)}>
          <option value="">Dispositivo Padre (opcional)</option>
          {devices.map((device) => (
            <option key={device._id} value={device._id}>
              {device.ip} - {device.name}
            </option>
          ))}
        </select>
        <button onClick={addDevice}>Agregar Dispositivo</button>
        <button onClick={handleUpdateDevices}>Actualizar Estado</button>
    
      </div>

      <div style={{ marginBottom: 10 }}>{message && <p>{message}</p>}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.keys(deviceGroups).map((segment) => (
          <div
            key={segment}
            onClick={() => handleTabChange(segment)}
            style={{
              margin: '0 10px',
              padding: '5px 10px',
              cursor: 'pointer',
              borderRadius: '5px',
              backgroundColor: activeTab === segment ? '#4CAF50' : '#ddd',
              color: activeTab === segment ? '#fff' : '#000',
            }}
          >
            {segment}
          </div>
        ))}
      </div>

      <div>
        {loading ? (
          <div>Cargando...</div>
          
        ) : (
          <DeviceTree devices={filteredDevices} />
        )}
      </div>
    </div>
  );
}

export default App;
