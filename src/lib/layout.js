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
        this.addLogEntry("serial", data);
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
    this.requestRoster();
    this.resetPoints();
  }

  onPinChanged(pin, value) {
      const blockInfo = this.state.blockLookup[pin];
      if (!blockInfo) {
        console.error(`Block info not found for pin: ${pin}`);
        return;
      }
      if (blockInfo.value === value) return; // No change
      this.addLogEntry("layout", `Block ${pin} changed to ${value}`);
            
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
       this.state.matchLocoModal = {
        show: true,
        pin,
      };
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

        return elementLookup;
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
        const response = await window.electronAPI.requestRoster();
        this.state.roster = response.map(data => new Loco(data, this));
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
      
      addLogEntry(source, msg) {  
        let me=this;
        console.log(`${source}: ${msg}`);
        const logEntry = {
          source: source,
          message: msg,
          timestamp: new Date().toLocaleTimeString()
        };
        me.state.logEntries.push(logEntry);
      }

  }
  
  export default Layout;