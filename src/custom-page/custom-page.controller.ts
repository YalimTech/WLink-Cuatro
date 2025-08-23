// src/custom-page/custom-page.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Controller('app')
export class CustomPageController {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // Alias: GET /app  → devuelve la misma página
  @Get()
  async getRoot(@Res() res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.type('html');
    res.send(this.generateCustomPageHTML());
  }

  // Alias: GET /app/custom-page  → devuelve la misma página
  @Get('custom-page')
  async getCustomPageAlias(@Res() res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.type('html');
    res.send(this.generateCustomPageHTML());
  }

  @Get('whatsapp')
  async getCustomPage(@Res() res: Response) {
    // Encabezados mínimos; el CSP y frame-ancestors ya se gestionan con Helmet en main.ts
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.type('html');
    res.send(this.generateCustomPageHTML());
  }

  @Post('decrypt-user-data')
  @HttpCode(HttpStatus.OK)
  async decryptUserData(
    @Body() body: { encryptedData: string },
    @Res() res: Response,
  ) {
    try {
      const sharedSecret = this.configService.get<string>('GHL_SHARED_SECRET');
      if (!sharedSecret) {
        this.logger.error('GHL_SHARED_SECRET not configured on the server.');
        return res
          .status(400)
          .json({ error: 'Shared secret not configured on the server.' });
      }

      const decrypted = CryptoJS.AES.decrypt(
        body.encryptedData,
        sharedSecret,
      ).toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        this.logger.warn(
          'GHL context decryption failed. Decrypted content is empty. Check your GHL_SHARED_SECRET.',
        );
        throw new UnauthorizedException('Invalid GHL context: decryption failed.');
      }

      const userData = JSON.parse(decrypted);

      this.logger.log('Decrypted user data received.');

      const locationId = userData.activeLocation;

      if (!locationId) {
        this.logger.warn({
          message: 'No activeLocation property found in decrypted GHL payload.',
          decryptedPayload: userData,
        });
        throw new UnauthorizedException('No active location ID in user context');
      }

      const user = await this.prisma.findUser(locationId);
      console.log('User found in DB:', user ? user.locationId : 'None');

      return res.json({
        success: true,
        locationId,
        userData, // Pass the full userData object
        user: user
          ? { locationId: user.locationId, hasTokens: !!(user.accessToken && user.refreshToken) }
          : null,
      });
    } catch (error) {
      this.logger.error('Error decrypting user data:', error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or malformed GHL context');
    }
  }

  /**
   * Genera el HTML completo para la página de gestión de instancias de WhatsApp.
   * Incluye la aplicación React con toda la lógica de UI y llamadas a la API.
   */
  private generateCustomPageHTML(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>WLink Bridge - Manager</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></link>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              transition: background-color 0.3s ease;
            }
            .dark-mode {
              background-color: #0D1117;
              background-image: radial-gradient(circle at top left, rgba(79, 70, 229, 0.15), transparent 40%),
                                radial-gradient(circle at bottom right, rgba(138, 43, 226, 0.15), transparent 40%);
            }
            .light-mode {
              background-color: #f3f4f6;
            }
            .bg-gradient-custom {
              background-image: linear-gradient(to right, #8A2BE2, #4F46E5, #2272FF, #4F46E5, #8A2BE2);
              background-size: 250% auto;
              transition: background-position 0.5s ease-in-out;
            }
            .bg-gradient-custom:hover {
              background-position: right center;
            }
            .bg-glass {
              transition: transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease, border-color 0.3s ease;
            }
            .dark-mode .bg-glass {
              background: rgba(23, 27, 42, 0.7);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .light-mode .bg-glass {
              background-color: #ffffff;
              border: 1px solid #e5e7eb;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            }
            .bg-glass:hover {
              transform: translateY(-6px);
            }
            .dark-mode .bg-glass:hover {
              box-shadow: 0 0 25px rgba(138, 43, 226, 0.3), 0 0 40px rgba(34, 114, 255, 0.2);
            }
            .light-mode .bg-glass:hover {
               box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            }
            .status-badge {
                position: relative;
                overflow: hidden;
            }
            .status-badge::before {
              content: '';
              position: absolute;
              top: 0;
              left: -150%;
              width: 75%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
              animation: shine 4s infinite linear;
            }
            @keyframes shine {
              0% { left: -150%; }
              50% { left: 150%; }
              100% { left: 150%; }
            }
            .modal-overlay {
              position: fixed; top: 0; left: 0; width: 100%; height: 100%;
              background-color: rgba(0, 0, 0, 0.7);
              display: flex; justify-content: center; align-items: center; z-index: 1000;
              backdrop-filter: blur(5px);
            }
            .modal-content {
              animation: fadeIn 0.3s ease-out;
              max-width: 90%; width: 450px; text-align: center;
              padding: 2rem; border-radius: 0.75rem;
            }
            .dark-mode .modal-content {
               background-color: #161b22; color: #e6edf3;
               border: 1px solid rgba(255, 255, 255, 0.1);
               box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            }
            .light-mode .modal-content {
              background-color: #ffffff; color: #1f2937;
              border: 1px solid #e5e7eb;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .spinner {
              border-radius: 50%; width: 40px; height: 40px;
              animation: spin 1s linear infinite;
            }
            .dark-mode .spinner {
              border: 4px solid rgba(255, 255, 255, 0.2);
              border-left-color: #8A2BE2;
            }
            .light-mode .spinner {
              border: 4px solid rgba(0, 0, 0, 0.1);
              border-left-color: #4f46e5;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body class="p-4 sm:p-6 min-h-screen flex items-center justify-center">
          <div id="root" class="w-full max-w-4xl mx-auto"></div>
          <script type="text/babel">
            const { useState, useEffect, useRef } = React;

            function App() {
              const [locationId, setLocationId] = useState(null);
              const [encrypted, setEncrypted] = useState(null);
              const [instances, setInstances] = useState([]);
              const [form, setForm] = useState({ instanceId: '', instanceName: '', token: '', customName: '' }); 
              const [qr, setQr] = useState('');
              const [showQr, setShowQr] = useState(false);
              const [qrLoading, setQrLoading] = useState(false); 
              const pollRef = useRef(null); 
              const mainIntervalRef = useRef(null); 
              const qrInstanceIdRef = useRef(null); 
              const qrCodeDivRef = useRef(null); 
              const [modal, setModal] = useState({ show: false, message: '', type: '', onConfirm: null, onCancel: null }); 
              const [ghlUser, setGhlUser] = useState({ name: 'Loading...', email: 'Loading...', hasTokens: false }); 
              const [editingInstanceId, setEditingInstanceId] = useState(null); 
              const [editingCustomName, setEditingCustomName] = useState('');
              const [appLogo, setAppLogo] = useState('/LOGO_ICON.png');
              const [appName, setAppName] = useState('WLink');
              const [theme, setTheme] = useState('dark');

              useEffect(() => {
                document.body.className = \`p-4 sm:p-6 min-h-screen flex items-center justify-center \${theme === 'dark' ? 'dark-mode text-gray-200' : 'light-mode text-gray-800'}\`;
              }, [theme]);

              const toggleTheme = () => {
                setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
              };

              // Función para mostrar el modal personalizado
              const showModal = (message, type = 'info', onConfirm = null, onCancel = null) => {
                setModal({ show: true, message, type, onConfirm, onCancel });
              };

              // Función para cerrar el modal personalizado
              const closeModal = () => {
                setModal({ show: false, message: '', type: '', onConfirm: null, onCancel: null });
              };

              // Efecto para obtener locationId y encrypted al cargar la página (desde el iframe)
              useEffect(() => {
                const listener = (e) => {
                  if (e.data?.message === 'REQUEST_USER_DATA_RESPONSE') {
                    processUser(e.data.payload);
                  }
                };
                window.addEventListener('message', listener);
                window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*'); // Solicitar datos de usuario al padre
                return () => window.removeEventListener('message', listener);
              }, []);

              // Efecto para cargar instancias y configurar el polling principal una vez que locationId esté disponible
              useEffect(() => {
                if (locationId) {
                  loadInstances();
                  // Configura el polling principal para refrescar el estado de las instancias cada 3 segundos
                  if (mainIntervalRef.current) clearInterval(mainIntervalRef.current); 
                  mainIntervalRef.current = setInterval(loadInstances, 3000); 
                }
                // Limpieza de intervalos al desmontar el componente
                return () => {
                  if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
                  if (pollRef.current) clearInterval(pollRef.current);
                };
              }, [locationId]);

              // Efecto para renderizar el QR cuando 'showQr' y 'qr' cambian
              useEffect(() => {
                console.log('QR useEffect triggered. showQr:', showQr, 'qr data present:', !!qr, 'qrCodeDivRef.current:', qrCodeDivRef.current);
                if (showQr && qr && qrCodeDivRef.current) {
                  qrCodeDivRef.current.innerHTML = ''; // Limpiar cualquier QR anterior
                  // QRCode.js puede tomar una URL de imagen base64 directamente
                  if (qr.startsWith('data:image')) {
                    const img = document.createElement('img');
                    img.src = qr;
                    img.className = "mx-auto max-w-full h-auto rounded-lg"; // Estilos para la imagen QR
                    qrCodeDivRef.current.appendChild(img);
                    console.log('QR rendered as image.');
                  } else {
                    // Si es un string de texto (código de emparejamiento), generarlo como QR
                    try {
                      new QRCode(qrCodeDivRef.current, {
                        text: qr,
                        width: 256,
                        height: 256,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                      });
                      console.log('QR rendered from text data.');
                    } catch (e) {
                      console.error('Error rendering QR from text:', e);
                      qrCodeDivRef.current.innerHTML = '<p class="text-red-500">Error al generar QR.</p>';
                    }
                  }
                } else if (showQr && !qrLoading && !qr) {
                    console.log('QR useEffect: showQr is true, but qr data is missing and not loading.');
                    if (qrCodeDivRef.current) {
                        qrCodeDivRef.current.innerHTML = '<p class="text-red-500">No se pudo cargar el código QR. Intente de nuevo.</p>';
                    }
                }
              }, [showQr, qr, qrLoading]); 

              // Función genérica para hacer solicitudes a la API con manejo de errores y headers
              async function makeApiRequest(path, options = {}) {
                const headers = {
                  'Content-Type': 'application/json',
                  'X-GHL-Context': encrypted, 
                  ...options.headers,
                };

                const response = await fetch(path, { ...options, headers });
                let data;
                try {
                  data = await response.json();
                } catch (e) {
                  console.error('Error parsing JSON from ' + path + '. Status: ' + response.status + ' ' + response.statusText, e, response);
                  throw new Error(data.message || response.statusText || 'Invalid JSON response from server');
                }
                if (!response.ok) {
                  console.error('API request to ' + path + ' failed. Status: ' + response.status + '. Response:', data);
                  throw new Error(data.message || 'API request failed');
                }
                console.log('API request to ' + path + ' successful. Response:', data);
                return data;
              }

              // Procesa los datos de usuario desencriptados del padre
              async function processUser(enc) {
                try {
                  const res = await makeApiRequest('/app/decrypt-user-data', { method: 'POST', body: JSON.stringify({ encryptedData: enc }) });
                  setEncrypted(enc);
                  setLocationId(res.locationId);
                  // Actualizar el estado con los datos reales del usuario de GHL
                  setGhlUser({
                    name: res.userData.fullName || (res.userData.firstName || '') + ' ' + (res.userData.lastName || '') || 'Unknown User',
                    email: res.userData.email || 'N/A',
                    hasTokens: res.user ? res.user.hasTokens : false 
                  });
                  
                  // CORRECCIÓN: Lógica mejorada para encontrar y establecer el logo y nombre de la app
                  console.log("Full GHL userData received:", res.userData);
                  const appData = res.userData.app || res.userData.company?.app;
                  if (appData) {
                    if (appData.logoUrl) {
                      setAppLogo(appData.logoUrl);
                      console.log("App Logo URL found and set:", appData.logoUrl);
                    }
                    if (appData.name) {
                      setAppName(appData.name);
                      console.log("App Name found and set:", appData.name);
                    }
                  } else {
                    console.warn("App data (logo, name) not found in the expected location within userData.");
                  }

                  console.log('User data decrypted and locationId set:', res.locationId);
                } catch (err) {
                  console.error('Error processing user data:', err);
                  showModal('Failed to load user data. Please ensure the app is installed correctly. ' + err.message, 'error');
                }
              }

              // Carga y refresca el estado de todas las instancias
              async function loadInstances() {
                try {
                  const data = await makeApiRequest('/api/instances');
                  setInstances(data.instances);
                  console.log('Main polling: Instances loaded:', data.instances);
                  // NUEVO LOG: Mostrar el estado de cada instancia individualmente
                  data.instances.forEach(inst => {
                      // CAMBIO: idInstance a instanceName; instanceGuid a instanceId
                      console.log('  Instance ' + inst.instanceName + ' (DB ID: ' + inst.id + ') state: ' + inst.state + ' Custom Name: ' + inst.customName);
                  });

                  // Lógica para cerrar el modal QR desde el polling principal
                  if (showQr && qrInstanceIdRef.current) {
                    const currentInstance = data.instances.find(inst => String(inst.id) === String(qrInstanceIdRef.current));
                    if (currentInstance && currentInstance.state !== 'qr_code' && currentInstance.state !== 'starting') {
                      console.log('Main polling: Closing QR modal as state is now ' + currentInstance.state + '.');
                      clearInterval(pollRef.current);
                      pollRef.current = null;
                      setShowQr(false);
                      setQr('');
                      qrInstanceIdRef.current = null;
                      if (currentInstance.state === 'authorized') {
                        showModal('Instancia conectada exitosamente!', 'success');
                      } else {
                        showModal('La conexión de la instancia cambió de estado. Verifique el panel.', 'info');
                      }
                    } else if (!currentInstance) {
                      console.log('Main polling: Closing QR modal as instance no longer exists.');
                      clearInterval(pollRef.current);
                      pollRef.current = null;
                      setShowQr(false);
                      setQr('');
                      qrInstanceIdRef.current = null;
                      showModal('La instancia ha sido eliminada o no existe.', 'error');
                    }
                  }
                } catch (e) {
                  console.error('Failed to load instances in main polling:', e);
                  // No mostrar modal de error aquí para evitar spam en el polling
                }
              }

              // Crea una nueva instancia
              async function createInstance(e) {
                e.preventDefault();
                try {
                  // CAMBIO: Payload ahora usa 'instanceName' y 'token' directamente del formulario
                  const payload = { 
                    locationId, 
                    instanceId: form.instanceId,   // GUID/ID de Evolution API
                    instanceName: form.instanceName, // Nombre único de Evolution API
                    token: form.token,               // API Token
                    customName: form.customName      // Opcional
                  };
                  await makeApiRequest('/api/instances', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  });
                  showModal('Instancia creada exitosamente!', 'success');
                  // CAMBIO: Limpiar formulario usando los nuevos nombres de campo
                  setForm({ instanceId: '', instanceName: '', token: '', customName: '' }); 
                  loadInstances(); // Recargar instancias después de crear una nueva
                } catch (err) {
                  console.error('Error creating instance:', err);
                  showModal('Error al crear instancia: ' + err.message, 'error');
                }
              }

              // Inicia el polling para el estado de una instancia específica (usado para QR)
              function startPolling(instanceId) {
                if (pollRef.current) {
                  clearInterval(pollRef.current);
                }
                qrInstanceIdRef.current = instanceId;
                
                pollRef.current = setInterval(async () => {
                  try {
                    const data = await makeApiRequest('/api/instances');
                    const updatedInstance = data.instances.find(inst => String(inst.id) === String(instanceId));
                    setInstances(data.instances); // Actualizar la lista de instancias para reflejar el estado más reciente

                    if (updatedInstance) {
                      console.log('QR polling for ' + instanceId + ': Fetched state ' + updatedInstance.state);
                      // Si el estado NO es 'qr_code' Y NO es 'starting', cerramos el modal y el polling.
                      if (updatedInstance.state !== 'qr_code' && updatedInstance.state !== 'starting') {
                        console.log('QR polling: State ' + updatedInstance.state + ' detected, closing QR modal.');
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        setShowQr(false);
                        setQr('');
                        qrInstanceIdRef.current = null;
                        if (updatedInstance.state === 'authorized') {
                          showModal('Instancia conectada exitosamente!', 'success');
                        } else {
                          showModal('La conexión de la instancia cambió de estado. Verifique el panel.', 'info');
                        }
                      }
                    } else {
                      console.log('QR polling: Instance ' + instanceId + ' not found in fetched data, stopping polling and closing QR.');
                      clearInterval(pollRef.current);
                      pollRef.current = null;
                      setShowQr(false);
                      setQr('');
                      qrInstanceIdRef.current = null;
                      showModal('La instancia ha sido eliminada o no existe.', 'error');
                    }
                  } catch (error) {
                    console.error('Error during QR polling:', error);
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    setShowQr(false);
                    setQr('');
                    qrInstanceIdRef.current = null;
                    showModal('Error al verificar estado del QR. Intente de nuevo.', 'error');
                  }
                }, 2000); 
              }

              // Conecta una instancia (obtiene y muestra el QR)
              async function connectInstance(id) {
                setQrLoading(true); 
                setQr(''); 
                setShowQr(true); 
                qrInstanceIdRef.current = id; 

                try {
                  console.log('Attempting to fetch QR for instance ID: ' + id);
                  const res = await makeApiRequest('/api/qr/' + id);
                  console.log('QR API response for ' + id + ':', res);
                  console.log('QR response type: ' + res.type + ', data starts with: ' + (res.data ? res.data.substring(0, 50) : 'N/A'));


                  if (res.type === 'qr') {
                    const finalQrData = res.data.startsWith('data:image') ? res.data : 'data:image/png;base64,' + res.data;
                    setQr(finalQrData);
                    console.log('QR type received. Setting QR data. Starts with data:image: ' + finalQrData.startsWith('data:image'));
                  } else if (res.type === 'code') {
                    console.log('Code type received. Generating QR from text: ' + res.data);
                    const qrImage = await generateQrFromString(res.data);
                    setQr(qrImage);
                  } else {
                    throw new Error('Unexpected QR response format. Type was: ' + res.type);
                  }
                  setQrLoading(false); 

                  startPolling(id);

                } catch (err) {
                  setQrLoading(false); 
                  console.error('Error obtaining QR:', err);
                  setQr('');
                  setShowQr(false); 
                  qrInstanceIdRef.current = null;
                  showModal('Error obteniendo QR: ' + err.message, 'error');
                  if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                  }
                }
              }

              // Genera una imagen QR a partir de una cadena de texto (para pairing codes)
              async function generateQrFromString(text) {
                return new Promise((resolve, reject) => {
                  if (!window.QRCode) {
                    console.error('QRCode library not loaded!');
                    return reject(new Error('QRCode library not loaded'));
                  }
                  const container = document.createElement('div');
                  new window.QRCode(container, {
                    text,
                    width: 256,
                    height: 256,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                  });
                  setTimeout(() => {
                    const img = container.querySelector('img') || container.querySelector('canvas');
                    if (img) {
                      const dataUrl = img.src || img.toDataURL('image/png');
                      console.log('Generated QR from string successfully.');
                      resolve(dataUrl);
                    } else {
                      console.error('Failed to find QR image in container after generation.');
                      reject(new Error('Failed to generate QR image'));
                    }
                  }, 100);
                });
              }

              // Desconecta una instancia (logout)
              async function logoutInstance(id) {
                showModal(
                  '¿Estás seguro de que quieres desconectar esta instancia? Esto cerrará la sesión de WhatsApp y requerirá un nuevo escaneo de QR para reconectar.',
                  'confirm',
                  async () => { 
                    closeModal(); 
                    try {
                      console.log('Attempting to logout instance ID: ' + id);
                      await makeApiRequest('/api/instances/' + id + '/logout', { method: 'DELETE' });
                      console.log('Instance ' + id + ' logout command sent successfully. Reloading instances...');
                      showModal('Comando de desconexión de instancia enviado. El estado se actualizará en breve y requerirá un nuevo escaneo.', 'success');
                      loadInstances(); 
                    } catch (err) {
                      console.error('Error disconnecting instance:', err);
                      showModal('Error al desconectar: ' + err.message, 'error');
                    }
                  },
                  () => closeModal() 
                );
              }

              // Elimina una instancia permanentemente
              async function deleteInstance(id) {
                showModal(
                  '¿Estás seguro de que quieres ELIMINAR esta instancia? Esta acción es permanente y borrará la instancia de Evolution API y de la base de datos.',
                  'confirm',
                  async () => { 
                    closeModal();
                    try {
                      console.log('Attempting to delete instance ID: ' + id);
                      await makeApiRequest('/api/instances/' + id, { method: 'DELETE' });
                      console.log('Instance ' + id + ' delete command sent. Reloading instances...');
                      showModal('Instancia eliminada exitosamente!', 'success');
                      loadInstances(); 
                    } catch (err) {
                      console.error('Error deleting instance:', err);
                      showModal('Error al eliminar instancia: ' + err.message, 'error');
                    }
                  },
                  () => closeModal() 
                );
              }

              // Función para iniciar la edición del nombre personalizado de una instancia
              const startEditingName = (instanceId, currentCustomName) => { 
                setEditingInstanceId(instanceId);
                setEditingCustomName(currentCustomName); 
              };

              // Función para guardar el nombre personalizado editado de una instancia
              const saveEditedName = async (instanceId) => {
                try {
                  await makeApiRequest('/api/instances/' + instanceId, {
                    method: 'PATCH',
                    body: JSON.stringify({ customName: editingCustomName }), 
                  });
                  showModal('Nombre de instancia actualizado exitosamente!', 'success');
                  setEditingInstanceId(null); 
                  setEditingCustomName('');
                  loadInstances(); 
                } catch (err) {
                  console.error('Error al actualizar el nombre de la instancia:', err);
                  showModal('Error al actualizar el nombre: ' + err.message, 'error');
                }
              };

              // Función para cancelar la edición del nombre personalizado de una instancia
              const cancelEditingName = () => {
                setEditingInstanceId(null);
                setEditingCustomName('');
              };

              // Placeholder para la función Open Console
              const openConsole = (instanceId) => {
                showModal('Abriendo consola para la instancia: ' + instanceId, 'info');
              };
              
              const managePayments = () => {
                showModal('Redirecting to payment management...', 'info');
                // Aquí iría la lógica para redirigir a la página de pagos
              }


              return (
                <div className="space-y-8 w-full">
                  {/* Header */}
                  <header className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center">
                            <img
                              src={appLogo}
                              alt="App Logo"
                              className="h-16 w-16 rounded-md"
                              onError={(e) => { e.currentTarget.src = '/LOGO_ICON.png'; }}
                            />
                        </div>
                        <div>
                            <h1 className={\`text-3xl font-bold \${theme === 'dark' ? 'text-white' : 'text-gray-900'}\`}>{appName}</h1>
                            <p className={\`\${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}\`}>Manage your instances with ease</p>
                        </div>
                    </div>
                    <button onClick={toggleTheme} className={\`p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 \${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-offset-gray-800 focus:ring-indigo-500' : 'bg-gray-200 text-indigo-600 hover:bg-gray-300 focus:ring-offset-gray-100 focus:ring-indigo-500'}\`}>
                      {theme === 'dark' ? 
                        <span className="text-xl leading-none">☀</span>
                        : 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                      }
                    </button>
                  </header>

                  <main className="space-y-6">
                    {/* Connection Status & Plan Details Card */}
                    <div className="bg-glass rounded-2xl p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Left Side: Connection Status */}
                        <div>
                          <h2 className={\`text-lg font-semibold mb-4 flex items-center \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>
                            <i className="fas fa-signal text-indigo-400 mr-3"></i> Connection Status
                          </h2>
                          <div className="space-y-3 text-sm">
                              <p className="flex items-center"><i className={\`fas fa-user mr-3 w-4 text-center \${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}\`}></i> <strong className={\`mr-2 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>User:</strong> <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>{ghlUser.name}</span></p>
                              <p className="flex items-center"><i className={\`fas fa-envelope mr-3 w-4 text-center \${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}\`}></i> <strong className={\`mr-2 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Email:</strong> <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>{ghlUser.email}</span></p>
                              <p className="flex items-center"><i className={\`fas fa-map-marker-alt mr-3 w-4 text-center \${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}\`}></i> <strong className={\`mr-2 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Location ID:</strong> <span className={\`break-all \${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}\`}>{locationId || 'Loading...'}</span></p>
                              <div className="pt-2">
                                  <h3 className={\`font-semibold mb-2 flex items-center text-sm \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>
                                      <i className="fas fa-shield-alt text-indigo-400 mr-2"></i> OAuth Status
                                  </h3>
                                  <div className="flex items-center space-x-3">
                                      <div className={\`w-full rounded-full h-2.5 \${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}\`}>
                                          <div className="bg-gradient-custom h-2.5 rounded-full" style={{ width: ghlUser.hasTokens ? '100%' : '0%' }}></div>
                                      </div>
                                  </div>
                                  <span className={\`font-medium whitespace-nowrap mt-2 block \${ghlUser.hasTokens ? 'text-green-400' : 'text-yellow-400'}\`}>
                                    {ghlUser.hasTokens ? 'Authenticated & Ready' : 'Not Authenticated'}
                                  </span>
                              </div>
                          </div>
                        </div>
                        {/* Right Side: Plan & Billing */}
                        <div>
                          <h2 className={\`text-lg font-semibold mb-4 flex items-center \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>
                            <i className="fas fa-credit-card text-indigo-400 mr-3"></i> Plan & Billing
                          </h2>
                          <div className={\`space-y-3 text-sm p-4 rounded-lg border \${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'}\`}>
                              <p className="flex justify-between items-center"><strong className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Current Plan:</strong> <span className="font-bold text-lg text-indigo-300">Pro</span></p>
                              <p className="flex justify-between items-center"><strong className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Connected Instances:</strong> <span className={\`font-medium \${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}\`}>{instances.filter(i => i.state === 'authorized').length} / 5</span></p>
                              <p className="flex justify-between items-center"><strong className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Next Payment:</strong> <span className={\`font-medium \${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}\`}>Sep 22, 2025</span></p>
                          </div>
                          <button onClick={managePayments} className="mt-4 w-full bg-gradient-custom text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all duration-300 ease-in-out hover:shadow-[0_0_25px_rgba(79,70,229,0.8)] hover:scale-105">
                            Manage Payments
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Your WhatsApp Instances Card */}
                    <div className="bg-glass rounded-2xl p-6">
                      <h2 className={\`text-lg font-semibold mb-6 flex items-center \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>
                        <i className="fab fa-whatsapp text-green-400 mr-3"></i> Your WhatsApp Instances
                      </h2>
                      <div className="space-y-4">
                        {instances.length === 0 && <p className={\`text-center py-4 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}\`}>No instances added yet. Add one below!</p>}
                        {instances.map((inst) => (
                          <div key={inst.id} className={\`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-4 rounded-xl border \${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white border-gray-200'}\`}>
                            <div className="flex-grow space-y-2 text-sm w-full md:w-auto">
                              {editingInstanceId === inst.id ? (
                                <div className="flex items-center gap-2">
                                  <input type="text" value={editingCustomName} onChange={(e) => setEditingCustomName(e.target.value)} className={\`bg-transparent border-b text-lg font-semibold focus:outline-none w-full \${theme === 'dark' ? 'border-indigo-500 text-white' : 'border-indigo-400 text-gray-900'}\`} />
                                  <button onClick={() => saveEditedName(inst.id)} className="text-green-400 hover:text-green-300"><i className="fas fa-check"></i></button>
                                  <button onClick={cancelEditingName} className="text-red-400 hover:text-red-300"><i className="fas fa-times"></i></button>
                                </div>
                              ) : (
                                <p className={\`font-semibold text-lg flex items-center \${theme === 'dark' ? 'text-white' : 'text-gray-900'}\`}>
                                  {inst.customName || 'Unnamed Instance'}
                                  <button onClick={() => startEditingName(inst.id, inst.customName || '')} className="ml-2 text-indigo-400 hover:text-indigo-300 text-sm" title="Edit Name"><i className="fas fa-pencil-alt"></i></button>
                                </p>
                              )}
                              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Instance Email: <span className={\`font-mono break-all \${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}\`}>{inst.instanceName || 'N/A'}</span></p>
                              {inst.instanceId && <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Instance ID: <span className={\`font-mono break-all \${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}\`}>{inst.instanceId}</span></p>}
                              <div className="flex items-center gap-2 pt-1">
                                <span className={\`status-badge relative overflow-hidden inline-block text-xs px-3 py-1 rounded-full font-medium \${inst.state === 'authorized' ? 'bg-green-500/20 text-green-300' : inst.state === 'notAuthorized' ? 'bg-red-500/20 text-red-300' : inst.state === 'blocked' || inst.state === 'yellowCard' ? 'bg-red-600/50 text-red-200' : 'bg-yellow-500/20 text-yellow-300'}\`}>
                                  {inst.state === 'authorized' ? 'Connected' : inst.state === 'notAuthorized' ? 'Disconnected' : inst.state === 'qr_code' ? 'Awaiting Scan' : inst.state === 'starting' ? 'Connecting...' : 'Needs Action'}
                                </span>
                                <p className={\`text-xs \${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}\`}>Created: {new Date(inst.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex flex-row md:flex-col gap-3 w-full md:w-auto">
                              <button onClick={() => openConsole(inst.id)} className={\`w-full md:w-40 font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out hover:scale-105 \${theme === 'dark' ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/80' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}\`}>Open Console</button>
                              {inst.state === 'authorized' ? (
                                <button onClick={() => logoutInstance(inst.id)} className={\`w-full md:w-40 font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out hover:scale-105 \${theme === 'dark' ? 'bg-yellow-500/20 text-white hover:bg-yellow-500/40' : 'bg-yellow-500 text-white hover:bg-yellow-600'}\`}>Logout</button>
                              ) : (
                                <button onClick={() => connectInstance(inst.id)} className="w-full md:w-40 bg-gradient-custom text-white font-bold py-2 px-4 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all duration-300 ease-in-out hover:shadow-[0_0_25px_rgba(79,70,229,0.8)] hover:scale-105">Connect</button>
                              )}
                              <button onClick={() => deleteInstance(inst.id)} className={\`w-full md:w-40 font-semibold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out hover:scale-105 \${theme === 'dark' ? 'bg-red-500/20 text-white hover:bg-red-500/40' : 'bg-red-600 text-white hover:bg-red-700'}\`}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Add New Instance Card */}
                    <div className="bg-glass rounded-2xl p-6">
                      <h2 className={\`text-lg font-semibold mb-4 flex items-center \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>
                        <i className="fas fa-plus-circle text-green-400 mr-3"></i> Add New Instance
                      </h2>
                      <form onSubmit={createInstance} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="instanceGuid" className={\`block text-sm font-medium mb-1 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Instance ID</label>
                            <input type="text" id="instanceGuid" className={\`sm:text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500 \${theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}\`} value={form.instanceId || ''} onChange={(e) => setForm({ ...form, instanceId: e.target.value })} placeholder="e.g., a1b2c3d3-e5f6h7-etc" required />
                          </div>
                          <div>
                            <label htmlFor="instanceName" className={\`block text-sm font-medium mb-1 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Instance Email</label>
                            <input type="text" id="instanceName" className={\`sm:text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500 \${theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}\`} value={form.instanceName} onChange={(e) => setForm({ ...form, instanceName: e.target.value })} placeholder="e.g., example@gmail.com" required />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="token" className={\`block text-sm font-medium mb-1 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Token</label>
                          <input type="text" id="token" className={\`sm:text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500 \${theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}\`} value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="A1B2-C3D4-F5G6H7-ETC" required />
                        </div>
                        <div>
                          <label htmlFor="customName" className={\`block text-sm font-medium mb-1 \${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}\`}>Instance Custom Name (Optional)</label>
                          <input type="text" id="customName" className={\`sm:text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500 \${theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'}\`} value={form.customName} onChange={(e) => setForm({ ...form, customName: e.target.value })} placeholder="e.g., Sales Team WhatsApp" />
                        </div>
                        <button type="submit" className="w-full bg-gradient-custom text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-all duration-300 ease-in-out hover:shadow-[0_0_25px_rgba(79,70,229,0.8)] hover:scale-105">Add Instance</button>
                      </form>
                    </div>
                  </main>

                  {/* QR Modal */}
                  {showQr && (
                    <div className="modal-overlay" onClick={() => setShowQr(false)}>
                      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className={\`text-2xl font-bold mb-4 \${theme === 'dark' ? 'text-white' : 'text-gray-800'}\`}>Scan QR Code</h2>
                        {qrLoading ? (
                          <div className="flex flex-col items-center justify-center h-64"><div className="spinner"></div><p className="mt-4 text-gray-400">Loading QR...</p></div>
                        ) : qr ? (
                          <div ref={qrCodeDivRef} className="flex items-center justify-center p-2 bg-white rounded-lg"></div>
                        ) : (
                          <p className="text-red-400">Could not load QR code. Please try again.</p>
                        )}
                        <button onClick={() => setShowQr(false)} className={\`mt-6 px-6 py-2 rounded-lg font-semibold transition \${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}\`}>Close</button>
                      </div>
                    </div>
                  )}

                  {/* General Modal */}
                  {modal.show && (
                    <div className="modal-overlay">
                      <div className="modal-content">
                        <p className={\`text-lg font-medium mb-6 \${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}\`}>{modal.message}</p>
                        <div className="flex justify-center gap-4">
                          {modal.type === 'confirm' && (
                            <button onClick={modal.onCancel} className={\`px-6 py-2 rounded-lg font-semibold transition \${theme === 'dark' ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}\`}>Cancel</button>
                          )}
                          <button onClick={modal.onConfirm || closeModal} className={\`px-6 py-2 rounded-lg text-white font-semibold shadow-md transition \${modal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}\`}>
                            {modal.type === 'confirm' ? 'Confirm' : 'OK'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            ReactDOM.render(<App />, document.getElementById('root'));
          </script>
        </body>
      </html>
    `;
  }
}
