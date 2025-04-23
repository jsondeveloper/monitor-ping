import React, { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [ipInput, setIpInput] = useState('');
  const [portInput, setPortInput] = useState('');
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
        port: portInput || '80',
        name: nameInput,
        type: typeInput,
        parent: parentInput || null,
      });
      setIpInput('');
      setPortInput('');
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
          flexDirection: isRoot ? 'row' : 'column',
          alignItems: isRoot ? 'top' : 'flex-start',
          position: 'relative',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginLeft: isRoot ? 0 : 0,
          borderLeft: isRoot ? 'none' : '2px solid #ccc',
          paddingLeft: isRoot ? 0 : 20,
          width: '100%',
        }}
      >
        {children.map((device) => {
          const hasChildren = devices.some((d) => (d.parent?._id || null) === device._id);
          return (
            <div
              key={device._id}
              style={{
                margin: isRoot ? '10px' : '10px 0',
                textAlign: 'left',
                position: 'relative',
                backgroundColor: isRoot ? '#fff' : 'transparent',
                boxShadow: isRoot ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                padding: isRoot ? 10 : 0,
              }}
            >
              {!isRoot && (
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: -20,
                    width: 20,
                    height: 2,
                    backgroundColor: '#ccc',
                  }}
                />
              )}
              <DeviceNode device={device} />
              {hasChildren && (
                <div style={{ marginTop: 10 }}>
                  <DeviceTree devices={devices} parentId={device._id} isRoot={false} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const DeviceNode = ({ device }) => {
    const backgroundColor = device.alive ? '#e0fbe0' : '#fde0e0';

    return (
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          border: '1px solid #ddd',
          padding: 5,
          backgroundColor,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          fontSize: '0.9em',
        }}
      >
        <img
          src={getDeviceImage(device.type)}
          alt={device.type}
          style={{ width: 20, height: 20 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span>
            -| <strong>{device.name || 'Sin nombre'}</strong> | {device.ip}
            {device.port !== 80 ? `:${device.port}` : ''} | {device.alive ? `🟢 (${device.method})` : `🔴 (${device.method})`}

          </span>
        </div>
        <button onClick={() => deleteDevice(device.ip)}>Eliminar</button>
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
    <div style={{ padding: 20, position: 'relative' }}>
      <h1>Monitor de Dispositivos</h1>

      <div style={{ marginBottom: 10 }}>
        <input value={ipInput} onChange={(e) => setIpInput(e.target.value)} placeholder="IP" />
        <input value={portInput} onChange={(e) => setPortInput(e.target.value)} placeholder="Puerto (opcional)" />
        <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nombre" />
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

      {message && <p>{message}</p>}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          margin: 20,
          justifyContent: 'center',
        }}
      >
        {Object.keys(deviceGroups).map((segment) => (
          <div
            key={segment}
            onClick={() => handleTabChange(segment)}
            style={{
              margin: '0 10px',
              padding: '5px 10px',
              cursor: 'pointer',
              backgroundColor: activeTab === segment ? '#ccc' : '#eee',
            }}
          >
            {segment}
          </div>
        ))}
      </div>

      <DeviceTree devices={filteredDevices} />

      {loading && <LoadingOverlay />}
    </div>
  );
}

const LoadingOverlay = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <div
      style={{
        width: 50,
        height: 50,
        border: '6px solid #f3f3f3',
        borderTop: '6px solid #3498db',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <style>
      {`@keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }`}
    </style>
  </div>
);

export default App;
