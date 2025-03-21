const { contextBridge, ipcRenderer } = require('electron');

  
contextBridge.exposeInMainWorld('electronAPI', {
  /*
   sendToElectron: (data) => ipcRenderer.send('vue-to-electron', data),
   onReceiveFromElectron: (callback) => ipcRenderer.on('electron-to-vue', (event, data) => callback(data)),
   */
   onConnected: (callback)  => ipcRenderer.on('port-connected', (event, data) => callback(data)),
   onPinChanged: (callback)  => ipcRenderer.on('on-pin', (event, data) => callback(data)),
   
   sendCommand: (command) => ipcRenderer.invoke('send-command', command),
   requestRoster: () => ipcRenderer.invoke('request-roster'),
   setCabSpeed: (cabNumber, speed, direction) => ipcRenderer.invoke('set-cab-speed', cabNumber, speed, direction),
   emergencyStop: () => ipcRenderer.invoke('emergency-stop'),
   setPinValue: (pin, value) => ipcRenderer.invoke('set-pin-value', pin, value),
   queryPinStatus: () => ipcRenderer.invoke('query-pin-status'),
   setTurnoutState: (turnoutId, throwState) => ipcRenderer.invoke('set-turnout-state', turnoutId, throwState),
   onSerialData: (callback) => ipcRenderer.on('serial-data', (event, id, data) => callback(event, id, data)),
 
});

