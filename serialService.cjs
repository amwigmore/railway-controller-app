const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class SerialService {
  constructor(port, baudRate = 115200) {
    this.port = new SerialPort({ path: port, baudRate });
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
    this.listeners = [];
    this.pendingRequests = []; // Queue for matching responses
    this.isConnected = false;

    // Handle incoming serial data
    this.parser.on('data', (data) => {
      const response = this.parseResponseString(data);
      if (response) {
        this.log("Parsed: " + data);
        this.handleResponse(response);
      } else {
        this.log("Unparsable: " + data);
        this.listeners.forEach((callback) => callback('unsolicited-data', data));
      }
    });

    // Handle serial port errors
    this.port.on('error', (err) => {
      this.log("Serial Port Error: " + err.message);
    });

    this.port.on('open', () => {
      this.isConnected = true;
      this.log(`Serial Port ${port} connected.`);
      this.listeners.forEach((callback) => callback('port-connected', port));
    });

    this.port.on('close', () => {
      this.isConnected = false;
      this.log(`Serial Port ${port} disconnected.`);
      this.listeners.forEach((callback) => callback('port-disconnected', port));
    });
  }

  // ✅ Send command with expected opcode
  async sendCommand(command, expectedOpcode) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(`Timeout waiting for response to command: ${command}`);
      }, 2000);

      // Queue request with expected opcode
      this.pendingRequests.push({ expectedOpcode, resolve, reject, timeout });

      this.log("Sending Command: " + command);

      this.port.write(`${command}\n`, (err) => {
        if (err) {
          clearTimeout(timeout);
          reject(`Error sending command: ${err.message}`);
        }
      });
    });
  }
  log(message) {
    console.log("SerialService Log:", message);
    callback('on-log', message)
  }
  // ✅ Handle response and match by opcode
  handleResponse(response) {
    const { opcode, params } = response;

    // Find matching pending request
    //this.log("Pending Requests: " + JSON.stringify(this.pendingRequests));
    //this.log("Response: " + opcode);
    const requestIndex = this.pendingRequests.findIndex(
      (req) => req.expectedOpcode === opcode
    );
    this.log("Request Index: " + opcode + " " + requestIndex);
    if (requestIndex !== -1) {
      const { resolve, timeout } = this.pendingRequests.splice(requestIndex, 1)[0];
      clearTimeout(timeout);
      //this.log("Request Index timeout: " + timeout);
      resolve({ opcode, params });
    } else {
      // No matching request → treat as unsolicited
      //this.log("Unsolicited data received: " + JSON.stringify(response));
      if ("Q"===opcode) {
        this.log(`on-pin ${params[0]}=1`);
        this.listeners.forEach((callback) => callback('on-pin', {pin: params[0], state: 1}));
      } else if ("q"===opcode) {
        this.log(`on-pin ${params[0]}=0`);
        this.listeners.forEach((callback) => callback('on-pin', {pin: params[0], state:0}));
      } else {
        this.listeners.forEach((callback) => callback('unsolicited-data', response));
      }
    }
  }

  // ✅ Parse response string into opcode and params
  parseResponseString(response) {
    // Match the entire string and extract the opcode and parameters
    const match = response.match(/^<(\w+)\s*(.*?)>$/);
    if (!match) return null;
  
    const opcode = match[1];
    const paramString = match[2];
  
    // Regex to match numbers, quoted strings, or empty quotes
    const paramRegex = /"([^"]*)"|(\S+)/g;
    const params = [];
    let paramMatch;
  
    while ((paramMatch = paramRegex.exec(paramString)) !== null) {
      if (paramMatch[1] !== undefined) {
        // Quoted string (can be empty)
        params.push(paramMatch[1]);
      } else if (paramMatch[2] !== undefined) {
        // Unquoted values (numbers or identifiers)
        const num = Number(paramMatch[2]);
        params.push(isNaN(num) ? paramMatch[2] : num);
      }
    }
  
    return { opcode, params };
  }
  isConnected() {
    return this.isConnected;  
  }
  // ✅ Request Roster and fetch details for each loco
  async requestRoster() {
    try {
      const rosterResponse = await this.sendCommand('<J R>', 'jR');
      if (!rosterResponse) throw new Error('No response received for roster request.');

      const locoIds = this.parseRoster(rosterResponse.params);
      if (!locoIds.length) throw new Error('No locomotives found in roster.');

      const locoDetails = await Promise.all(
        locoIds.map(async (id) => {
          try {
            const locoResponse = await this.sendCommand(`<J R ${id}>`, 'jR');
            return this.parseLocoDetails(locoResponse);
          } catch (locoError) {
            this.log(`Error fetching details for loco ID ${id}: ${locoError}`);
            return null;
          }
        })
      );

      return locoDetails.filter(Boolean); // Remove nulls from failed requests
    } catch (error) {
      this.log(`Error fetching roster: ${error}`);
      throw error;
    }
  }

  // Parse roster response to extract loco IDs
  parseRoster(params) {
    return params.map(Number);
  }

  // Parse loco details from response
  parseLocoDetails(response) {
    const match = response.opcode.match(/^jR$/);
    if (!match) {
      this.log("Malformed response: " + JSON.stringify(response));
      return null;
    }

    const [id, description, functions] = response.params;
    return {
      id: Number(id),
      label: description || '',
      functions: functions ? functions.split('/') : [],
      direction: 1,
      speed: 0,
      requestedSpeed: 0,
      locations: [],
      route:{
        start:null,
        end:null,
        path:null,
      }
    };
  }

  // ✅ Set Cab Speed
  async setCabSpeed(cabNumber, speed, direction) {
    if (speed < 0 || speed > 126) throw new Error('Speed must be between 0 and 126');
    if (![0, 1].includes(direction)) throw new Error('Direction must be 0 (reverse) or 1 (forward)');
    return this.sendCommand(`<t ${cabNumber} ${speed} ${direction}>`, 'l');
  }

  // ✅ Emergency Stop
  async emergencyStop() {
    return this.sendCommand('<!>', '!');
  }

  // ✅ Set Pin Value
  async setPinValue(pin, value) {
    if (![0, 1].includes(value)) throw new Error('Value must be 0 or 1');
    return this.sendCommand(`<P ${pin} ${value}>`, 'P');
  }

  // ✅ Query Pin Status
  async queryPinStatus() {
    return this.sendCommand('<Q>', 'Q');
  }

  // ✅ Set Turnout State
  async setTurnoutState(turnoutId, throwState) {
    if (![0, 1].includes(throwState)) throw new Error('Throw state must be 0 (close) or 1 (throw)');
    return this.sendCommand(`<T ${turnoutId} ${throwState}>`, 'H');
  }

  // ✅ Process general responses like pin changes
  processResponse(data) {
    const parsedResponse = this.parseResponseString(data);
    if (!parsedResponse) return;

    if (parsedResponse.opcode === "Q") {
      this.log(`Pin ${parsedResponse.params[0]} on`);
    } else if (parsedResponse.opcode === "q") {
      this.log(`Pin ${parsedResponse.params[0]} off`);
    }
  }

  // ✅ Subscribe to incoming serial data
  on(eventType, callback) {
    this.listeners.push((event, data) => {
      if (event === eventType) {
        callback(event,data);
      }
    });
  }

  // ✅ Close serial port on app exit
  close() {
    if (this.port.isOpen) {
      this.port.close();
    }
  }
}

module.exports = SerialService;
