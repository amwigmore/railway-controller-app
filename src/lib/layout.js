class Layout extends EventTarget {
    

    constructor(state) {
        super();
        this.state=state;

    }
  
    // Method to initialize or load layout
    init() {
        this.state.roster = [{
              id:3,
              label:"Flying Scotsman",
              color:"#FF0000",
              speed:0,
              requestedSpeed:0,
              direction:1,
              locations:[],
              route:{
                start:null,
                end:null,
                active:false,
              }
            }, {
              id:4,
              label:"Thomas",
              color:"#0000FF",
              speed:0,
              requestedSpeed:0,
              direction:1,
              locations:[],
              route:{
                start:null,
                end:null,
                active:false,
              }
            }];

        

        window.electronAPI.onConnected((data) => {
            let me=this;
            me.addLogEntry("layout", `Connected to ${data}`);
            me.state.connectionInfo="Connected to "+data;
            me.state.isConnected=true;

            setTimeout(()=>{ 
                //console.log(`Requesting roster`);
                let roster=me.requestRoster();
                me.addLogEntry("layout", `Roster: ${roster.length} locomotives found`);
              }, 2000)
          });
      
          window.electronAPI.onPinChanged((data) => {
            let me=this;
            me.onPinChanged(data.pin,data.state );
          });
      
          window.electronAPI.onSerialData((event, id, data) => {
           
      
            if ("port-connected"===id) {
              me.addLogEntry("layout", `Connected to ${data}`);
              me.state.connectionInfo="Connected to "+data;
              setTimeout(()=>{ 
                let roster=me.requestRoster();
                me.addLogEntry("layout", `Roster: ${roster.length} locomotives found`);
              }, 1000)
             
            } else {
              me.addSerialOutput(id+":"+data);
            }
          });
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
                  //element: element,
                  id: pathInfo.id,
                  pin: pathInfo.id,
                  forward: pathInfo.forward,
                  backward: pathInfo.backward,
                  value: 0,
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
        let [id, forwardData, backwardData] = segmentStr.split("|");

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

        return {
          id,
            forward: parseConnection(forwardData),
            backward: parseConnection(backwardData)
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
        //console.log("Roster Response:", response);
       
        me.state.roster = response;
    }
    

    stopLoco(loco) {
        loco.speed=0;
        this.setCabSpeed(loco);
      }
      
    updateSpeedDirection(loco) {
        this.setCabSpeed(loco);
    }

    setCabSpeed(loco) {
        let me=this;

        if (!me.state.isConnected) return;
        window.electronAPI.setCabSpeed(loco.id, loco.speed, loco.direction)
          .then((response) => {
            me.addSerialOutput(`Cab Speed Response: ${response}`);
          });
    }

    setLocoRouteStart(loco, blockInfo) {
        let me=this;
        loco.route.start=blockInfo;
        if (loco.route.start && loco.route.end) {
          loco.route.path=me.findShortestPath(loco.route.start, loco.route.end);
         // me.renderRoute(loco);
        }
    }

    setLocoRouteEnd(loco, blockInfo) {
        let me=this;
        loco.route.end=blockInfo;
        if (loco.route.start && loco.route.end) {
          loco.route.path=me.findShortestPath(loco.route.start, loco.route.end);
         // me.renderRoute(loco);
        }
    }
    reverseRoute(loco) {
        let me=this;
        if (loco.route.start && loco.route.end) {
            const end=loco.route.end;
            loco.route.end=loco.route.start;
            loco.route.start=end;
            loco.route.path=me.findShortestPath(loco.route.start, loco.route.end);
        }
    }
    clearRoute(loco) {
        loco.route.end=null;
        loco.route.start=null;
        loco.route.path=null;
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

        if (!me.state.isConnected) return;
        window.electronAPI.setTurnoutState(point.vpin, point.state).then((response) => {
          me.addSerialOutput(`Turnout Response: ${response}`);
        });
    }


    addSerialOutput(msg) {
        if (!msg) return;
        this.state.serialOutput=msg+"<br/>"+this.serialOutput;
    }


    onPinChanged(pin, value) {
        let me=this;
        const blockInfo=me.state.blockLookup[pin];
        if (!blockInfo) return;
        blockInfo.value=value;
        pin=blockInfo.pin;
  
        this.dispatchEvent(new CustomEvent('pin-changed', {
            detail: { blockInfo, value }
        }));
  
        if (value===0) {
  
          me.state.roster.forEach(d=> {
            if (d.locations.includes(pin)) {
              me.locoBlockLocationChanged(d, pin, 0);
            }
          });
  
          return;
        }
  
        const possibleMatches={fwd:[], back:[]};
  
  
  
        Object.keys(me.state.blockLookup).forEach(key => {
          const value=me.state.blockLookup[key]
          if (value.forward.connections.includes(pin)) {
            possibleMatches.fwd.push(value);
          }
          if (value.backward.connections.includes(pin)) {
            possibleMatches.back.push(value);
          }
          
        });
        
        //console.log(`${pin} entry - fwd: ${possibleMatches.fwd.reduce((a, d) => a+","+d.pin,"")}, back: ${possibleMatches.back.reduce((a, d) => a+","+d.pin,"")}`)
        me.addLogEntry("layout", `Pin ${pin} entry detected - fwd: ${possibleMatches.fwd.reduce((a, d) => a+","+d.pin,"")}, back: ${possibleMatches.back.reduce((a, d) => a+","+d.pin,"")}`);
        //console.log(`Pin ${pin} entry - fwd: ${possibleMatches.fwd.reduce((a, d) => a+","+d.pin,"")}, back: ${possibleMatches.back.reduce((a, d) => a+","+d.pin,"")}`)
        let found=false;
        let lastBlockLoco = null;
        me.state.roster.forEach(d=> {
            if (!d.speed) return;
            
            if (d.direction===1) {
              possibleMatches.fwd.forEach(blockInfo=>{
                if (d.locations.includes(blockInfo.pin)) {
                  found=true;
                  me.locoBlockLocationChanged(d, pin, 1);
                }
              });
            } else {
              possibleMatches.back.forEach(blockInfo=>{
                if (d.locations.includes(blockInfo.pin)) {
                  found=true;
                  me.locoBlockLocationChanged(d, pin, 1);
                }
              });
            }
            
            if (d._lastBlockId && d._lastBlockId===pin && d.locations.length===0) {
              lastBlockLoco=d;
              
            }

           

        });
        //fall back to last block loco if no match found
        if (!found && lastBlockLoco) {
         // console.log(`Guessed that last block loco ${lastBlockLoco.id} is at ${pin}`);
          me.addLogEntry("layout", `Guessed that last block loco ${lastBlockLoco.id} is at ${pin}`);
          me.locoBlockLocationChanged(lastBlockLoco, pin, 1);
          found=true;
        }
        if (!found) {
          let movingLocos = me.state.roster.filter(d=> d.speed>0);
          if (movingLocos.length===0) {
            //console.log(`No loco found for block ${pin}`);
            me.addLogEntry("layout", `No loco found for block ${pin}`);
          } else if (movingLocos.length===1) {
            //console.log(`Guessed that loco ${movingLocos[0].id} is at ${pin}`);
            me.addLogEntry("layout", `Guessed that moving loco ${movingLocos[0].id} is at ${pin}`);
            me.locoBlockLocationChanged(movingLocos[0], pin, 1);
            found=true;
          } else if (movingLocos.length>1) {
            //console.log(`Multiple locos found for block ${pin}`);
            me.addLogEntry("layout", `Multiple locos found for block ${pin}`);
          }
        }
        if (!found) {
          //console.log(`No loco found for block ${pin}`);
          me.addLogEntry("layout", `No loco found for block ${pin}`);
        }
       
      }
      

      locoBlockLocationChanged(loco, blockId, state) {
        let me = this;
      
        // Ensure loco has a debounce tracker
        if (!loco._debounceTimers) {
          loco._debounceTimers = {};
        }
      
        if (state === 1) {
          // Cancel any pending debounce removal
          if (loco._debounceTimers[blockId]) {
            clearTimeout(loco._debounceTimers[blockId]);
            delete loco._debounceTimers[blockId];
          }
      
          if (!loco.locations.includes(blockId)) {
            loco.locations.push(blockId);
          }
      
        } else {
          // Debounce block exit
          if (loco._debounceTimers[blockId]) {
            clearTimeout(loco._debounceTimers[blockId]);
          }
      
          loco._debounceTimers[blockId] = setTimeout(() => {
            // Final check: only remove if it's still there
            loco.locations = loco.locations.filter(id => id !== blockId);
      
            if (loco.locations.length === 0) {
              //console.log(`Loco ${loco.label} left block ${blockId} with no more locations`);
              me.addLogEntry("layout", `Loco ${loco.label} left block ${blockId} with no more locations`);
            }
            loco._lastBlockId = blockId;

            delete loco._debounceTimers[blockId];
      
            if (me.hasActiveRoute(loco)) {
              me.handleLocoRouteBlockLocationChanged(loco);
            }
          }, 1000); // Adjust debounce time as needed
        }
      }

      handleLocoRouteBlockLocationChanged(loco) {
          let me=this;
          if (loco.locations.length>1) {
            return;
          }
          
          const path=loco && loco.route.path;
          const currentHeadLocation=me.getCurrentLocoHeaderRouteStep(loco);
          if (currentHeadLocation>=path.length-1) {
            loco.speed=0;
            //console.log(`Loco ${loco.label} reached end of route`);
            me.addLogEntry("layout", `Loco ${loco.label} reached end of route`);
            loco.requestedSpeed=0;
            this.setCabSpeed(loco);
            return;
          }
          const nextSegment=path[currentHeadLocation];
          if (!nextSegment) {
            return;
          }
          if (nextSegment.type==="point") { 
            
          }
          let locoSpeedChanged=false;
          if (nextSegment.direction==="forward" && loco.direction!==1) {
            loco.direction=1;
            locoSpeedChanged=true;
          } else if (nextSegment.direction==="backward" && loco.direction!==0) {
            loco.direction=0;
            locoSpeedChanged=true;
          }

          setTimeout(()=>{
            me.setPointsForRoute(loco, 1);
            if (locoSpeedChanged) me.setCabSpeed(loco);
          }, 2000);

          

      }

      simulateNext() {
        let me = this;
        me.state.roster.forEach(loco=>{
          if (!me.hasActiveRoute(loco) || !loco.locations.length) return;
          if (loco.locations.length>1) {
            me.onPinChanged(loco.locations[0], 0);
            return;
          }
          let currentHeadLocation=me.getCurrentLocoHeaderRouteStep(loco);
          if (currentHeadLocation==-1) {

            return;
          }
          const path=loco && loco.route.path;
          /*
          if (currentHeadLocation===path.length) {
            loco.speed=0;
            loco.requestedSpeed=0;
            this.setCabSpeed(loco);
            return;
          }
            */
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

      hasActiveRoute(loco) {
        let me=this;
        const path=loco && loco.route.path;
        return path && loco.route.active && loco.requestedSpeed>0;
      }


      startRoute(loco, speed = 75) {
        let me=this;
        const path=loco && loco.route.path;
        if (!path) return;
        let firstStep=loco.route.path[0]

        loco.requestedSpeed = speed;
        loco.locations = [firstStep.id];
        loco.speed=speed;
        loco.direction=firstStep.direction==="forward"? 1 : 0;
        loco.route.active=true;
        me.setPointsForRoute(loco, 1);

        me.setCabSpeed(loco);
      }
      

      getCurrentLocoHeaderRouteStep(loco) {
        const path=loco && loco.route.path;
        if (!path) return;
        let currentHeadLocation=path.reduce((a, step, i)=>{
          if (loco.locations.includes(step.id)) {
            return i;
          }
          return a;

        }, -1);
        return currentHeadLocation;
      }
      
      setPointsForRoute(loco, maxStepsAhead = -1) {
        let me=this;
        let currentHeadLocation=this.getCurrentLocoHeaderRouteStep(loco);
        /*
        const path=loco && loco.route.path;
        if (!path) return;
        let currentHeadLocation=path.reduce((a, step, i)=>{
          if (loco.locations.includes(step.id)) {
            return i;
          }
          return a;

        }, -1);
        */
        if (currentHeadLocation===-1) {
         // console.log("Loco not found on route");
          me.addLogEntry("layout", `Loco ${loco.label} not found on route`);
          return;
        }
        const path=loco && loco.route.path;
        let maxStep=maxStepsAhead != -1? currentHeadLocation+maxStepsAhead+1 : path.length
        if (maxStep>path.length) {
          maxStep=path.length;
        }

        for (let i=currentHeadLocation; i<maxStep; i++) {
          const step=path[i];
          if (step.type==="point") {
            const point=me.state.pointLookup[step.id];
            if (point) {
              me.setPointState(point, step.direction==="straight"? 1 : 0);
            }
          }
        }


      }

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