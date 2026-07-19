// Layout.js
import Loco from './loco.js';
class Layout extends EventTarget {
    

  constructor(state) {
    super();
    this.state = state;
  }
  
  init() {
    this.state.roster = [
        new Loco({ id: 3, label: "Flying Scotsman", color: "#FF0000", speed: 0, requestedSpeed: 0, direction: 1, route: { start: null, end: null, active: false } }, this),
        new Loco({ id: 4, label: "Thomas", color: "#0000FF", speed: 0, requestedSpeed: 0, direction: 1, route: { start: null, end: null, active: false } }, this)
    ];

    window.electronAPI.onConnected((data) => {
        //this.addLogEntry("layout", `Connected to ${data}`);
        //this.state.connectionInfo = "Connected to " + data;
        //this.state.isConnected = true;

         this.onPortConnected("Connected to " + data);
    });

    window.electronAPI.onDisconnected((data) => {
        this.addLogEntry("layout", `Disconnected from ${data}`);  
        this.state.connectionInfo = "Disconnected";
        this.state.isConnected = false;
    });

    window.electronAPI.isSerialConnected().then((isConnected) => {
        if (isConnected) {
            //this.addLogEntry("layout", "Already connected to serial port.");
            //this.state.connectionInfo = "Connected";
            //this.state.isConnected = true;
            this.onPortConnected("Already connected to serial port.");
        } else {
            this.addLogEntry("layout", "Not connected to serial port.");
            this.state.connectionInfo = "Disconnected";
            this.state.isConnected = false;
        }
    });

    window.electronAPI.onLog((data) => {
        this.addLogEntry("serial", data.message);
    });

    window.electronAPI.onPinChanged((data) => {
        this.onPinChanged(data.pin, data.state);
    });

    window.electronAPI.onSerialData((event, id, data) => {
        if (id === "port-connected") {
            //this.addLogEntry("layout", `Connected to ${data} (raw)`);
            //this.state.connectionInfo = "Connected to " + data;
            this.onPortConnected(`Connected to ${data} (raw)`);
        } else {
            this.addSerialOutput(id + ":" + data);
        }
    });



  }

  onPortConnected(connectionInfo, delay = 2000) {
    this.addLogEntry("layout", connectionInfo);
    this.state.connectionInfo = connectionInfo;
    this.state.isConnected = true;

    if (delay > 0) {
      setTimeout(() => {
        this.postStartUp();
      }, delay);
      return;
    } else {
      this.postStartUp();
    }
    
  }
  postStartUp() {
    // Load roster from localStorage first for immediate UI population
    this.loadRosterFromLocalStorage();
    // Restore calibration stats after roster is loaded
    this.restoreLocoCalibrationStats();
    // Then request updated roster from DCC (will merge/update existing locos)
    this.requestRoster();
    this.resetPoints();
  }

  loadRosterFromLocalStorage() {
    try {
      const savedRoster = localStorage.getItem('locoRoster');
      if (savedRoster) {
        const rosterData = JSON.parse(savedRoster);
        this.state.roster = rosterData.map(data => new Loco(data, this));
        console.log(`✓ Loaded ${this.state.roster.length} locos from localStorage`);
      }
    } catch (error) {
      console.error('Error loading roster from localStorage:', error);
      // Continue without cached roster, DCC will provide it
    }
  }

  onPinChanged(pin, value) {
      const blockInfo = this.state.blockLookup[pin];
      if (!blockInfo) {
        console.error(`Block info not found for pin: ${pin}`);
        return;
      }
      if (blockInfo.value === value) return; // No change
      this.addLogEntry("layout", `Block ${pin} changed to ${value}`, true); // Debug log
            
      pin = blockInfo.pin;

      blockInfo.value = value;

      this.dispatchEvent(new CustomEvent('pin-changed', {
          detail: { blockInfo, value }
      }));

      if (value === 0) {
          this.state.roster.forEach(loco => {
            /*
              if (loco.locations.includes(pin)) {
                  loco.blockLocationChanged(pin, 0);
              }
                  */
          });
          return;
      }

      const possibleMatches = { fwd: [], back: [] };
      Object.values(this.state.blockLookup).forEach(value => {
          if (value.forward.connections.includes(pin)) {
              possibleMatches.fwd.push(value);
          }
          if (value.backward.connections.includes(pin)) {
              possibleMatches.back.push(value);
          }
      });

      let found = false;
      let lastBlockLoco = null;

      this.state.roster.forEach(loco => {
          if (!loco.speed) return;

          if (loco.direction === 1) {
              possibleMatches.fwd.forEach(blockInfo => {
                  if (loco.isOccupyingBlock(blockInfo.pin)) {
                      found = true;
                      loco.blockLocationChanged(pin, 1);
                  }
              });
          } else {
              possibleMatches.back.forEach(blockInfo => {
                  if (loco.isOccupyingBlock(blockInfo.pin)) {
                      found = true;
                      loco.blockLocationChanged(pin, 1);
                  }
              });
          }


          if (loco._lastBlockId === pin && loco.hasPosition()) {
              lastBlockLoco = loco;
          }

      });

      if (!found && lastBlockLoco) {
          this.addLogEntry("layout", `Guessed that last block loco ${lastBlockLoco.id} is at ${pin}`);
          lastBlockLoco.blockLocationChanged(pin, 1);
          found = true;
      }

      if (!found) {
          const movingLocos = this.state.roster.filter(loco => loco.speed > 0);
          if (movingLocos.length === 0) {
              this.addLogEntry("layout", `No loco found for block ${pin}`);
              this.resolveBlockConnection(pin);
          } else if (movingLocos.length === 1) {
              this.addLogEntry("layout", `Guessed that moving loco ${movingLocos[0].id} is at ${pin}`);
              movingLocos[0].blockLocationChanged(pin, 1);
              found = true;
          } else {
              this.addLogEntry("layout", `Multiple moving locos for block ${pin}`);
          }
      }
    }
    
    //attempt to match a block connection to a loco
    resolveBlockConnection(pin) {
       this.state.matchLocoModal.show = true;
       this.state.matchLocoModal.pins.push(pin);
    }
    
    processLayoutSvg(svg) {
        let me=this;
        //const svg = me.$refs.svgContainer?.querySelector('svg');
        if (!svg) return {};

        const blockLookupMap = {};

        const pointLookupMap = {};

        const elementLookup = {
            blocks: {},
            points: {}
        };



        svg.querySelectorAll('*').forEach(element => {
            const desc = element.querySelector('desc');
            if (!desc) return;
            
            const descValue = desc.textContent.trim();
            if (!descValue) return;

            if (element.tagName.toLowerCase() === "path") {
              
              //let pathInfo=me.parseAdjacencyList(descValue);
              let pathInfo = me.parseSegment(descValue);

              if (!pathInfo.forward.connections && !pathInfo.backward.connections) {
                console.error(`No adjancienes for ${descValue}`)
              }
              blockLookupMap[pathInfo.id] = {
                  element: element, //base element
                  id: pathInfo.id,
                  pin: pathInfo.id,
                  forward: pathInfo.forward,
                  backward: pathInfo.backward,
                  value: 0,
                  length: pathInfo.length,
                  speedlimit: pathInfo.speedlimit,
              };

              elementLookup.blocks[pathInfo.id]=element;

            } else if (element.tagName.toLowerCase() === "ellipse") {
              const point=me.parseTurnoutDescString(descValue);
              if (point) {
                pointLookupMap[point.vpin] = point;

                elementLookup.points[point.vpin]=element;
                //me.setUpTurnoutDisplay(pointLookupMap[turnout.vpin]);
              }
            } 
            
        });
       
        me.state.blockLookup=blockLookupMap;
        me.state.pointLookup=pointLookupMap;

        // Load calibrated segment lengths from localStorage
        this.loadSegmentCalibration();

        return elementLookup;
    }

    saveSegmentCalibration() {
        const calibration = {};
        Object.entries(this.state.blockLookup).forEach(([blockId, block]) => {
            if (block.length !== undefined) {
                calibration[blockId] = block.length;
            }
        });
        localStorage.setItem('segmentCalibration', JSON.stringify(calibration));
        this.addLogEntry("layout", "Segment calibration saved");
    }

    loadSegmentCalibration() {
        try {
            const saved = localStorage.getItem('segmentCalibration');
            if (!saved) return;
            
            const calibration = JSON.parse(saved);
            Object.entries(calibration).forEach(([blockId, length]) => {
                const block = this.state.blockLookup[blockId];
                if (block) {
                    block.length = length;
                }
            });
            this.addLogEntry("layout", "Segment calibration loaded");
        } catch (error) {
            this.addLogEntry("layout", `Error loading calibration: ${error.message}`);
        }
    }

    saveLocoCalibrationStats() {
        // Save detailed calibration stats for all locos
        const calibrationData = {};
        this.state.roster.forEach(loco => {
            calibrationData[loco.id] = loco.blockCalibration;
        });
        localStorage.setItem('locoCalibrationStats', JSON.stringify(calibrationData));
    }

    restoreLocoCalibrationStats() {
        // Restore calibration stats for locos after they're created
        try {
            const saved = localStorage.getItem('locoCalibrationStats');
            if (!saved) return;
            
            const calibrationData = JSON.parse(saved);
            this.state.roster.forEach(loco => {
                if (calibrationData[loco.id]) {
                    loco.blockCalibration = calibrationData[loco.id];
                    // Re-apply calibrated lengths to blocks
                    Object.entries(loco.blockCalibration).forEach(([blockId, cal]) => {
                        if (cal.avg && cal.stdDev < cal.avg * 0.2) {
                            const blockInfo = this.state.blockLookup[blockId];
                            if (blockInfo) {
                                blockInfo.length = Math.round(cal.avg);
                            }
                        }
                    });
                }
            });
            console.log('✓ Restored calibration stats for locos');
        } catch (error) {
            console.error('Error restoring calibration stats:', error);
        }
    }
    parseSegment(segmentStr) {
        let [id, forwardData, backwardData, length, speedlimit] = segmentStr.split("|");

        function parseConnection(data) {
            if (!data) return {
              pointId: null,
              connections: []
            }
            let [pointId, segments] = data.split(":");
            let [straight, diverging] = segments ? segments.split("/") : [[], []];
            return {
                pointId: pointId === "-" ? null : pointId,
                connections: [straight, diverging].filter(d=>d)
            };
        }
        if (!length || !speedlimit) {
          console.log(`Parsing segment: ${segmentStr}. ID: ${id}, Length: ${length}, Speedlimit: ${speedlimit}`);
        }
        return {
          id,
          forward: parseConnection(forwardData),
          backward: parseConnection(backwardData),
          length,
          speedlimit
        };
    }

    parseAdjacencyList(input) {
        // Split the string by the first space to separate the ID and the rest of the list
        const parts = input.split(' ');

        // The first part is the ID
        const id = parts[0];

        // The second part is a comma-separated list of integers, convert them to an array of integers
        const forward = parts[1].split(',');
        const backward = parts[2]?parts[2].split(','):[];
        return {
            id: id,
            forward: forward,
            backward: backward,
        };
    }
    parseTurnoutDescString(descString) {
        // Regular Expression to capture numbers, quoted text, and identifiers
        const regex = /(\d+)|"([^"]+)"|([A-Za-z0-9_]+)/g;

        const result = [];
        let match;

        // Parse using regex
        while ((match = regex.exec(descString)) !== null) {
          if (match[1]) {
            result.push(Number(match[1])); // Numbers
          } else if (match[2]) {
            result.push(match[2]); // Quoted description
          } else if (match[3]) {
            result.push(match[3]); // Identifier
          }
        }

        // Map results to object properties
        return {
          vpin: result[0] || null,
          pin1: result[1] || null,
          pin2: result[2] || null,
          desc: result[3] || '',
          id: result[4] || '',
          state:0,
        };
    }
    getActiveForwardConnection(block) {
        if (!block.forward.pointId) {
            // No turnout here, just return the first connection
            return block.forward.connections[0];
        }
    
        const point = this.state.pointLookup[block.forward.pointId];
        if (!point) return null;
    
        const state = point.state; // 0 = straight, 1 = diverging
      return block.forward.connections[state===1?0:1];
    }
    
    getActiveBackwardConnection(block) {
        if (!block.backward.pointId) {
            return block.backward.connections[0];
        }
    
        const point = this.state.pointLookup[block.backward.pointId];
        if (!point) return null;
    
        const state = point.state;
        return block.backward.connections[state===1?0:1];
    }
    isBlockOccupied(blockId) {
        if (!blockId) return false;
    
        for (const loco of this.state.roster) {
            const pos = loco.trainPosition;
            if (!pos) continue;
    
            // Match start, end, or any intermediate occupied block
            if (
                pos.startBlockId === blockId ||
                pos.endBlockId === blockId ||
                (Array.isArray(pos.occupiedBlocks) && pos.occupiedBlocks.includes(blockId))
            ) {
                return loco;
            }
        }
    
        return null;
    }
    
    findShortestPath(startId, endId) {
        const blockLookup = this.state.blockLookup;
        let me=this;
        const findRoute = (allowBackward) => {
            const queue = [{ id: startId, steps: [], visitedPoints: {}, usedBackward: false, totalLength: 0 }];
            const visited = new Map();
            
            while (queue.length > 0) {
                queue.sort((a, b) => a.totalLength - b.totalLength); // Sort by shortest total length first
                const { id, steps, visitedPoints, usedBackward, totalLength } = queue.shift();
                
                if (id === endId) {
                    // Construct ordered path with both segments and points in correct sequence
                    const combinedSteps = [];
                    for (let i = 0; i < steps.length; i++) {
                        //if (visitedPoints[steps[i].id]) {
                         //   combinedSteps.push({ type: 'point', id: visitedPoints[steps[i].id].pointId, direction: visitedPoints[steps[i].id].direction });
                        //}
                        combinedSteps.push({ type: 'segment', id: steps[i].id, direction: steps[i].direction, length: blockLookup[steps[i].id]?.length || 10 });
                        let nextId;
                        if (i<steps.length-1) {
                            nextId = steps[i+1].id
                        } else {
                            nextId = id; //end
                        }
                        const node = blockLookup[ steps[i].id];
                        if (steps[i].direction==="forward") {
                          let index=node.forward.connections.indexOf(nextId);
                          if (index==-1) {
                            //console.log(`Next node not found!`);
                            me.addLogEntry("layout", `Next node not found!`);
                          } else if (node.forward.pointId) {
                            combinedSteps.push({ type: 'point', id: node.forward.pointId, direction: index===0? "straight" : "diverging" });
                          } else {
                            const nextNode = blockLookup[nextId];
                            if ( nextNode.backward.pointId) {
                                index=nextNode.backward.connections.indexOf(steps[i].id);
                                combinedSteps.push({ type: 'point', id: nextNode.backward.pointId, direction: index===0? "straight" : "diverging" });
                            }
                          }
                        } else if ( node.backward.pointId) {
                            let index=node.backward.connections.indexOf(nextId);
                            if (index==-1) {
                                 me.addLogEntry("layout", `Next node not found!`);
                              } else if (node.backward.pointId) {
                                combinedSteps.push({ type: 'point', id: node.backward.pointId, direction: index===0? "straight" : "diverging" });
                              } else {
                                const nextNode = blockLookup[nextId];
                                if ( nextNode.forward.pointId) {
                                    index=nextNode.forward.connections.indexOf(steps[i].id);
                                    combinedSteps.push({ type: 'point', id: nextNode.forward.pointId, direction: index===0? "straight" : "diverging" });
                                }
                              }
                        }

                    }
                    
                    //if (visitedPoints[id]) {
                    //    combinedSteps.push({ type: 'point', id: visitedPoints[id].pointId, direction: visitedPoints[id].direction });
                    //}
                    combinedSteps.push({ type: 'segment', id: id, direction: 'forward', length: blockLookup[id]?.length || 10 });
                    
                    return combinedSteps;
                }
                
                if (visited.has(id) && visited.get(id) <= totalLength) continue;
                visited.set(id, totalLength);
                
                const node = blockLookup[id];
                if (!node) continue;
                
                // Always prioritize forward connections first
                const forwardNeighbors = node.forward.connections.map(conn => ({ conn, direction: 'forward', usedBackward, length: blockLookup[conn]?.length || 10 }));
                let backwardNeighbors = [];
                
                // Allow backward connections only if necessary
                if (allowBackward) {
                    backwardNeighbors = node.backward.connections.map(conn => ({ conn, direction: 'backward', usedBackward: true, length: blockLookup[conn]?.length || 10 }));
                }
                
                const neighbors = [...forwardNeighbors, ...backwardNeighbors];
                
                for (const { conn, direction, usedBackward, length } of neighbors) {
                    if (!visited.has(conn) || visited.get(conn) > totalLength + length) {
                        const newSteps = [...steps, {id:id, direction}];
                        /*
                        const newVisitedPoints = { ...visitedPoints };
                        
                        // If this is a railway point (has two connections), determine its direction
                        if (node.forward.connections.length === 2) {
                            newVisitedPoints[id] = { pointId: node.forward.pointId, direction: conn === node.forward.connections[0] ? 'straight' : 'diverging' };
                        }
                        
                        // Also mark points when passing through from the back
                        if (node.backward.pointId) {
                            newVisitedPoints[id] = { pointId: node.backward.pointId, direction: conn === node.backward.connections[0] ? 'straight' : 'diverging' };
                        }
                        */
                        queue.push({ id: conn, steps: newSteps, visitedPoints: null, usedBackward, totalLength: totalLength + length });
                    }
                }
            }
            return null; // No path found
        };
        // First, try finding a route without using backwards
        let route = findRoute(false);
        if (!route) {
            me.addLogEntry("layout", `No forward-only path found between ${startId} and ${endId}, allowing backward movement.`);
            route = findRoute(true);
        }
        //console.log(route);
        me.addLogEntry("layout", `Route from ${startId} to ${endId}: ${route.length} steps`);
        return route;
    }

    async requestRoster() {
        let me=this;
        try {
            const response = await window.electronAPI.requestRoster();
            if (!response || response.length === 0) {
                console.log('ℹ️ No roster data from DCC, keeping existing locos from localStorage');
                return;
            }

            // Merge DCC roster with existing locos from localStorage
            const dccLocos = response.map(data => new Loco(data, this));
            const existingIds = new Set(me.state.roster.map(l => l.id));
            
            // Update existing locos with DCC data
            dccLocos.forEach(dccLoco => {
                const existingLoco = me.state.roster.find(l => l.id === dccLoco.id);
                if (existingLoco) {
                    // Update properties but preserve state (position, speed, adjustments, calibration)
                    Object.assign(existingLoco, {
                        label: dccLoco.label,
                        address: dccLoco.address,
                        speed: dccLoco.speed,
                        direction: dccLoco.direction,
                        route: dccLoco.route
                    });
                    console.log(`✓ Updated loco ${dccLoco.label} from DCC`);
                } else {
                    // New loco from DCC, add it
                    me.state.roster.push(dccLoco);
                    console.log(`✓ Added new loco ${dccLoco.label} from DCC`);
                }
            });

            // Save updated roster to localStorage for next startup
            const rosterToSave = me.state.roster.map(loco => ({
                id: loco.id,
                label: loco.label,
                address: loco.address,
                speed: loco.speed,
                direction: loco.direction,
                route: loco.route
            }));
            localStorage.setItem('locoRoster', JSON.stringify(rosterToSave));
        } catch (error) {
            console.error('Error requesting roster from DCC:', error);
            // Roster from localStorage remains available
        }
    }
    

   

   
    emergencyStop() {
        let me=this;
        me.state.roster.forEach((loco) => {
            loco.speed=0;
        });
        if (!me.state.isConnected) return;
        window.electronAPI.emergencyStop().then((response) => {
           me.addSerialOutput(`Emergency Stop: ${response}`);
        });
        
    }

    setPinValue() {
        let me=this;
        if (!me.state.isConnected) return;
        window.electronAPI.setPinValue(this.pinNumber, this.pinValue).then((response) => {
           me.addSerialOutput(`Set Pin Response: ${response}`);
        });
    }

    queryPinStatus() {
        let me=this;
        if (!me.state.isConnected) return;
        window.electronAPI.queryPinStatus().then((response) => {
           me.addSerialOutput(`Pin Status: ${response}`);
        });
        setTimeout(() => {
            me.refreshLocoPositions();
        }, 1000);
    }
    refreshLocoPositions() {
      Object.values(this.state.blockLookup).forEach(block => {
        const loco = this.isBlockOccupied(block.id);
        if (block.value === 0) {
          if (loco) {
            this.addLogEntry("refreshLocoPositions", `Block ${block.id} is not occupied by loco ${loco.id}`);
            loco.blockLocationChanged(block.pin, 1);
            loco.blockLocationChanged(block.pin, 0);
          }
        } else if (block.value === 1) {
          if (!loco) {
            this.addLogEntry("refreshLocoPositions", `Resolving block connection for ${block.pin}`);
            this.resolveBlockConnection(block.pin);
          }
        }
      });

    }

    resetPoints() {
        let me=this;
        if (!me.state.pointLookup) return;
        for (const [key, value] of Object.entries(me.state.pointLookup)) {
          me.setPointState(value, 1);
        }
    }


    setPointState(point, state) {
        let me=this;
        point.state=state;
        //DCC EX POINT STATE 0==straight, 1==diverging
        if (!me.state.isConnected) return;
        window.electronAPI.setTurnoutState(point.vpin, point.state).then((response) => {
          me.addSerialOutput(`Turnout Response: ${response}`);
        });
    }


    addSerialOutput(msg) {
        if (!msg) return;
        this.state.serialOutput=msg+"<br/>"+this.serialOutput;
    }

    /*
    simulateNext() {
        let me = this;
        me.state.roster.forEach(loco=>{

          if (!loco.hasActiveRoute() || !loco.hasPosition()) return;

          if (loco.hasPosition()) {
            me.onPinChanged(loco.locations[0], 0);
            return;
          }

          let currentHeadLocation = loco.getCurrentRouteStep();
          if (currentHeadLocation==-1) {

            return;
          }
          const path=loco && loco.route.path;

          let nextSegment=path.reduce((a, step, i)=>{
            if (a || i<=currentHeadLocation || step.type!=="segment") return a;
            return step;
          }, null);

          if (!nextSegment) {

            return;
          }
          me.onPinChanged(nextSegment.id, 1);

          
          
            
          });
      }
*/
      getBlocksWithRoute() {
        const blockWithRoute={

        };
        this.state.roster.forEach(loco=>{
          if (loco.route.path) {
            loco.route.path.forEach(block=>{
              blockWithRoute[block.id] = blockWithRoute[block.id] || [];
              blockWithRoute[block.id].push(loco);
            });
          } 
        });

        return blockWithRoute;
      }
      
      addLogEntry(source, msg, isDebug = false) {  
        let me=this;
        // Only log to console for important messages (not isDebug)
        if (!isDebug) {
          console.log(`${source}: ${msg}`);
        }
        const logEntry = {
          source: source,
          message: msg,
          timestamp: new Date().toLocaleTimeString()
        };
        me.state.logEntries.push(logEntry);
        // Keep only last 100 entries to prevent memory buildup
        if (me.state.logEntries.length > 100) {
          me.state.logEntries.shift();
        }
      }

      compareLocoCalibrations() {
        // Compare calibration across all locos to identify inconsistencies
        const comparison = {
          timestamp: Date.now(),
          locos: []
        };

        this.state.roster.forEach(loco => {
          try {
            const calibData = loco.exportCalibrationForComparison();
            if (calibData && calibData.blockSummaries) {
              comparison.locos.push(calibData);
            }
          } catch (error) {
            console.error(`Error exporting calibration for loco ${loco?.label}:`, error);
          }
        });

        // Find blocks measured by multiple locos
        const blockMap = {};
        comparison.locos.forEach(loco => {
          if (!loco || !loco.blockSummaries) return;
          loco.blockSummaries.forEach(block => {
            if (!block || !block.blockId) return;
            if (!blockMap[block.blockId]) {
              blockMap[block.blockId] = [];
            }
            blockMap[block.blockId].push({
              locoLabel: loco.locoLabel,
              avgMeasured: block.avgMeasured || 0,
              consistency: block.consistency || 0,
              linearity: block.linearity || false,
              count: block.count || 0
            });
          });
        });

        // Analyze consistency between locos
        const blockAnalysis = {};
        Object.entries(blockMap).forEach(([blockId, measurements]) => {
          // Include all blocks with measurements, not just those with multiple locos
          if (measurements.length >= 1) {
            const validMeasurements = measurements.filter(m => 
              m && typeof m.avgMeasured === 'number' && m.avgMeasured > 0
            );
            
            if (validMeasurements.length === 0) return; // Skip if no valid data
            
            const averages = validMeasurements.map(m => m.avgMeasured);
            const avg = averages.reduce((a, v) => a + v, 0) / averages.length;
            const variance = averages.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / averages.length;
            const stdDev = Math.sqrt(variance);
            
            // Get the existing track block length
            const blockInfo = this.state.blockLookup[blockId];
            const trackLength = blockInfo?.length || 0;

            blockAnalysis[blockId] = {
              blockId,
              trackLength,
              locoCount: validMeasurements.length,
              measurements: validMeasurements,
              groupAverage: parseFloat(avg.toFixed(1)),
              groupStdDev: parseFloat(stdDev.toFixed(1)),
              groupConsistency: parseFloat(((1 - stdDev / avg) * 100).toFixed(1)),
              allLinear: measurements.every(m => m.linearity)
            };
          }
        });

        return {
          ...comparison,
          blockAnalysis
        };
      }

      getAllCalibrationDataExport() {
        // Export all calibration data in a structured format
        return {
          exportTime: new Date().toISOString(),
          locos: this.state.roster.map(loco => loco.getAllCalibrationData())
        };
      }
  }
  
  export default Layout;