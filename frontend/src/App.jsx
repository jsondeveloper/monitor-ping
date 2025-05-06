import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';


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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ username: '', password: '', role: '' });
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [totalDevices, setTotalDevices] = useState(0);
  const [activeDevices, setActiveDevices] = useState(0);
  const [inactiveDevices, setInactiveDevices] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState(null);



  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setRole(decoded.role);
      } catch (err) {
        console.error('Error al decodificar token:', err);
      }
    }
  }, []);


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    const savedAuth = localStorage.getItem('isAuthenticated');
    const savedUsername = localStorage.getItem('username');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      setLoginCredentials((prev) => ({ ...prev, username: savedUsername || '' }));
    }
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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
  const openEditModal = (device) => {
    setDeviceToEdit(device);
    setEditModalOpen(true);
  };
  const handleUpdateDevice = async () => {
    try {
      const updatedDevice = {
        ...deviceToEdit,
        port: deviceToEdit.port?.toString().trim() === '' ? '80' : deviceToEdit.port,
      };
  
      await axios.put(`http://localhost:3001/devices/${deviceToEdit.ip}`, updatedDevice);
      setMessage('Dispositivo actualizado exitosamente');
      fetchDevices(); // Vuelve a cargar los dispositivos
      setEditModalOpen(false); // Cierra el modal
    } catch (err) {
      console.error('Error al actualizar dispositivo:', err);
      setMessage('Error al actualizar dispositivo');
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

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginCredentials({ ...loginCredentials, [name]: value });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/login', loginCredentials);
      if (res.status === 200) {
        const { token } = res.data;

        localStorage.setItem('token', token); // Guarda el token
        localStorage.setItem('username', loginCredentials.username);
        localStorage.setItem('isAuthenticated', 'true');

        // Decodifica el token para obtener el rol
        const decoded = jwtDecode(token);
        const userRole = decoded.role;
        setRole(userRole); // Actualiza el estado del rol
        localStorage.setItem('role', userRole); // Guarda también el rol si quieres persistencia

        setIsAuthenticated(true);
        setMessage('Inicio de sesión exitoso');
      }
    } catch (error) {
      console.error('Error de login:', error);
      setMessage('Credenciales incorrectas');
    }
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

  useEffect(() => {
    const segmentDevices = activeTab
      ? devices.filter((d) => d.ip.startsWith(activeTab))
      : devices;

    const total = segmentDevices.length;
    const active = segmentDevices.filter((d) => d.alive).length;
    const inactive = total - active;

    setTotalDevices(total);
    setActiveDevices(active);
    setInactiveDevices(inactive);
  }, [activeTab, devices]);

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
                margin: isRoot ? '8px' : '8px 0',
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
                    top: -8,
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
          fontSize: '0.8em',
        }}
      >
        <img
          src={getDeviceImage(device.type)}
          alt={device.type}
          style={{ width: 20, height: 20, marginRight: 5 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span>
            | <strong>{device.name || 'Sin nombre'}</strong> | {device.ip}
            {device.port !== 80 ? `:${device.port}` : ''} | {device.alive ? `🟢 ` : `🔴 `}
          </span>
        </div>
        {role === 'admin' && (
          <>
            
            <button onClick={() => openEditModal(device)} style={{ margin: 0, padding: 0, background: 'transparent', border: 'none', marginLeft:5 }}>
            ✏️ 
            </button>
            <button onClick={() => deleteDevice(device.ip)} style={{ margin: 0, padding: 0, background: 'transparent', border: 'none', marginLeft:5 }}>
            ❌ 
            </button>
          </>
        )}

      </div>
    );
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDevices();
      const interval = setInterval(fetchDevices, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const deviceGroups = groupDevicesBySegment();
  const filteredDevices = activeTab
    ? devices.filter((d) => d.ip.startsWith(activeTab))
    : devices;

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.setItem('isAuthenticated', 'false');
    setIsAuthenticated(false);
    setUsername('');
    setLoginCredentials({ username: '', password: '' });
    setMessage('Sesión cerrada');
  };

  return (
    <div>
      {isAuthenticated ? (
        <div style={{ position: 'relative' }}>

          <div className="dashboard-container">
            <div className="item logo">
              <img src="/images/logo.png" alt="logo" />
            </div>

            <div className="stats-wrapper">
              <div className="item stat">
                <div className="badge green">
                  <p><strong>{activeDevices}</strong> Activos 🟢</p>
                </div>
              </div>

              <div className="item stat">
                <div className="badge red">
                  <p ><strong>{inactiveDevices}</strong> Inactivos 🔴</p>
                </div>
              </div>

              <div className="item stat">
                <div className="badge blue">
                  <p><strong>{totalDevices}</strong> EnTotal 🔵</p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '10px 0'
                }}
              >
                <button
                  onClick={() => setActiveTab('')}
                  style={{
                    padding: '4px 16px',
                    borderRadius: '4px',
                    backgroundColor: activeTab === '' ? '#007bff' : '#f8f9fa',
                    color: activeTab === '' ? '#fff' : '#495057',
                    border: '1px solid #ced4da',
                    cursor: 'pointer',
                    fontWeight: activeTab === '' ? 'bold' : 'normal',
                  }}
                >
                  Todos
                </button>
                {Object.keys(deviceGroups).sort().map((segment) => (
                  <button
                    key={segment}
                    onClick={() => handleTabChange(segment)}
                    style={{
                      padding: '4px 16px',
                      borderRadius: '4px',
                      backgroundColor: activeTab === segment ? '#007bff' : '#f8f9fa',
                      color: activeTab === segment ? '#fff' : '#495057',
                      border: '1px solid #ced4da',
                      cursor: 'pointer',
                      fontWeight: activeTab === segment ? 'bold' : 'normal',
                    }}
                  >
                    {segment}.x
                  </button>
                ))}
                <button onClick={handleUpdateDevices} style={{ padding: 5, borderRadius: 4, cursor: 'pointer', backgroundColor: '#28a745', color: '#fff', border: 'none' }}>Actualizar Estado</button>
              </div>
            </div>

            <div className="item user">
              <p style={{ margin: '0 0 5px', color: '#fff' }}>
                ¡Hola! <strong>{loginCredentials.username}</strong>
              </p>
              <button onClick={handleLogout}>Cerrar sesión</button>
            </div>


          </div>



          {role === 'admin' && (
            <div
              style={{
                margin: '2em',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                <option value="router">Router</option>
                <option value="antena">Antena</option>
                <option value="server">Servidor</option>
              </select>
              <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nombre" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              <input value={ipInput} onChange={(e) => setIpInput(e.target.value)} placeholder="IP" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              <input value={portInput} onChange={(e) => setPortInput(e.target.value)} placeholder="Puerto (opcional)" style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              <select value={parentInput} onChange={(e) => setParentInput(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                <option value="">Dispositivo Padre (opcional)</option>
                {devices.map((device) => (
                  <option key={device._id} value={device._id}>
                    {device.ip} - {device.name}
                  </option>
                ))}
              </select>
              <button onClick={addDevice} style={{ padding: 10, borderRadius: 4, backgroundColor: '#28a745', cursor: 'pointer', color: '#fff', border: 'none' }}>Agregar Dispositivo</button>
            </div>
          )}
          {message && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                margin: '0 auto',
                borderRadius: '8px',
                top: 0,
                color: '#fff',
                width: '100%',
                height: '2em',
                fontWeight: 'bold',
                position: 'fixed',
                top: 0,
                left: '50%',
                fontSize: '1.5rem',
                backgroundColor: message.includes('éxito') || message.includes('exitosamente') || message.includes('exitoso') ? '#38a169' : '#e53e3e',
                opacity: message ? 1 : 0,
                transform: message ? 'translateY(0)' : 'translateY(0)',
                transform: 'translate(-50%, 0%)',
                transition: 'all 0.5s ease-in-out',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              {message}
            </div>
          )}



          <DeviceTree devices={filteredDevices} />

          {editModalOpen && deviceToEdit && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <div style={{ backgroundColor: '#fff', padding: 20, borderRadius: 8, minWidth: 300 }}>
                <h3>Editar Dispositivo</h3>
                <label>Nombre:</label>
                <input
                  type="text"
                  value={deviceToEdit.name}
                  onChange={(e) => setDeviceToEdit({ ...deviceToEdit, name: e.target.value })}
                /><br />
                <label>IP:</label>
                <input
                  type="text"
                  value={deviceToEdit.ip}
                  disabled
                /><br />
                <label>Puerto:</label>
                <input
                  type="text"
                  value={deviceToEdit?.port}
                  onChange={(e) => setDeviceToEdit({ ...deviceToEdit, port: e.target.value })}
                /><br />
                <label>Tipo:</label>
                <select
                  value={deviceToEdit.type}
                  onChange={(e) => setDeviceToEdit({ ...deviceToEdit, type: e.target.value })}
                >
                  <option value="router">Router</option>
                  <option value="antena">Antena</option>
                  <option value="server">Servidor</option>
                </select><br />

                <label>Dispositivo Padre:</label>
                <select
                  value={deviceToEdit.parent || ''}
                  onChange={(e) => setDeviceToEdit({ ...deviceToEdit, parent: e.target.value })}
                >
                  <option value="">Sin padre</option>
                  {devices
                    .filter((d) => d.ip !== deviceToEdit.ip)
                    .map((device) => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.ip})
                      </option>
                    ))}
                </select><br /><br />

                <button onClick={handleUpdateDevice}>Guardar</button>
                <button onClick={() => setEditModalOpen(false)} style={{ marginLeft: 10 }}>Cancelar</button>
              </div>
            </div>
          )}


          {loading && <LoadingOverlay />}
        </div>


      ) : (
        <form onSubmit={handleLoginSubmit}>
          <input
            type="text"
            name="username"
            value={loginCredentials.username}
            onChange={handleLoginChange}
            placeholder="Usuario"
          />
          <input
            type="password"
            name="password"
            value={loginCredentials.password}
            onChange={handleLoginChange}
            placeholder="Contraseña"
          />
          <button type="submit">Iniciar sesión</button>
        </form>
      )}
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
      backgroundColor: 'rgba(0, 0, 0, 0.47)',
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
  </div>
);
export default App;
