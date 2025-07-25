const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport'); // ✅ Updated import
const { ReadlineParser } = require('@serialport/parser-readline'); // ✅ Updated import
const SerialService = require('./serialService.cjs');

let mainWindow;
let serial;


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // optional
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

 
  

  // ✅ Optional: show dev tools for debugging
  // mainWindow.webContents.openDevTools();

  // ✅ Catch and log loading failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load index.html:', errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeSerialPort();
  });

  ipcMain.handle('is-serial-connected', async () => {
    return await serial!=null && serial.isConnected();
  });

  startSerialPortListener();


   // ✅ Load the built Vue file
  console.log("NODE_ENV:", process.env.NODE_ENV);
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}




app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ✅ Handle app quit (all windows closed)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeSerialPort(); // ✅ Close port on app quit
    app.quit();
  }
});

// ✅ Handle Cmd+Q or other quit events on macOS
app.on('before-quit', () => {
  console.log('App quitting...');
  closeSerialPort();
});

// ✅ Function to cleanly close the serial port
function closeSerialPort() {
  if (serial) {
    serial.close((err) => {
      if (err) {
        console.error('Error closing port:', err.message);
      } else {
        console.log('Serial port closed successfully.');
      }
    });
  }
}
function startSerialPortListener() {
  let previousPorts = {};

  setInterval(async () => {
    const ports = await SerialPort.list();
    const currentPorts = {};

    // Populate currentPorts as a mapping: path => port object
    ports.forEach((port) => {
      currentPorts[port.path] = port;

      // If the port is new (not in previousPorts), notify connection
      if (!previousPorts[port.path]) {
        

        console.log(
          `🔌 Serial Port Connected: ${port.path} - ${port.vendorId}, ${port.productId}`
        );
        if (!serial && port.vendorId=="2341" && port.productId=="0042") {
          console.log("Likely dcc-ex");
          openSerialPort(port);
        }
        // You can now use the full port object as needed.
        
        mainWindow.webContents.send('electron-to-vue', { msg: `🔌 Serial Port Connected: ${port.path} - ${port.vendorId}, ${port.productId}` });
        //mainWindow?.webContents.send('serial-port-connected', port);
      }
    });

    // Check for disconnected ports
    Object.keys(previousPorts).forEach((path) => {
      if (!currentPorts[path]) {
        console.log(`❌ Serial Port Disconnected: ${path}`);
        mainWindow.webContents.send('electron-to-vue', { msg: `Serial Port Disconnected: ${path}` });
        //mainWindow?.webContents.send('serial-port-disconnected', previousPorts[path]);
      }
    });

    previousPorts = currentPorts;
  }, 1000); // Poll every second
}


function openSerialPort(port) {

  serial = new SerialService(port.path); // Replace with your actual port
  
  

  // Send generic command
  ipcMain.handle('send-command', async (event, command) => {
    return await serial.sendCommand(command);
  });

  // Request Roster
  ipcMain.handle('request-roster', async () => {
    return await serial.requestRoster();
  });

  // Set Cab Speed
  ipcMain.handle('set-cab-speed', async (event, cabNumber, speed, direction) => {
    return await serial.setCabSpeed(cabNumber, speed, direction);
  });


  // Emergency Stop
  ipcMain.handle('emergency-stop', async () => {
    return await serial.emergencyStop();
  });

  // Set Pin Value
  ipcMain.handle('set-pin-value', async (event, pin, value) => {
    return await serial.setPinValue(pin, value);
  });

  // Query Pin Status
  ipcMain.handle('query-pin-status', async () => {
    return await serial.queryPinStatus();
  });
 

  // Set Turnout State
  ipcMain.handle('set-turnout-state', async (event, turnoutId, throwState) => {
    return await serial.setTurnoutState(turnoutId, throwState);
  });

  // Forward log messages from SerialService to the renderer process UI log
  serial.on('on-log', (msg) => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('serial-log', {
        timestamp: Date.now(),
        source: 'serial',
        message: msg
      });
    }
  });


  // Forward serial data to renderer
  serial.on('serial-data', (event, data) => {
    mainWindow.webContents.send('serial-data',event, data);
  });
  // Forward serial data to renderer
  serial.on('port-connected', (event, data) => {
    //console.log(`Sending ${event}, ${data}`)
    mainWindow.webContents.send('port-connected', data);
  });

  // Forward serial data to renderer
  serial.on('port-disconnected', (event, data) => {
    mainWindow.webContents.send('port-disconnected', data); 
  });

   // Forward serial data to renderer
   serial.on('on-pin', (event, data) => {
    //console.log(`on-pin ${data.pin}, ${data.state}`)
    mainWindow.webContents.send('on-pin', data);
  });

};

ipcMain.on('open-port', async (event, portName) => {
  try {
    serialPort = new SerialPort({
      path: portName,
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });

    serialPort.on('error', (err) => {
      console.error('Serial Port Error:', err.message);
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (data) => {
      console.log('Serial Data:', data);
    });



  } catch (err) {
    console.error('Failed to open serial port:', err);
  }
});

ipcMain.on('send-data', (event, data) => {
  if (serialPort && serialPort.isOpen) {
    serialPort.write(data + '\n', (err) => {
      if (err) {
        event.reply('error', `Error sending data: ${err.message}`);
      } else {
        event.reply('data-sent', `Sent: ${data}`);
      }
    });
  } else {
    event.reply('error', 'Serial port is not open');
  }
});

// Listen for data from Vue
ipcMain.on('vue-to-electron', (event, data) => {
  console.log('Received from Vue:', data);

  // Respond back to Vue
  event.reply('electron-to-vue', { msg: 'Data received in Electron', received: data });
});
