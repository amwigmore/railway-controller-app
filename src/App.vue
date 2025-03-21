<template>
  <div class="w-100 h-100">
    <div class="row h-20 bg-light">
      <div class="col-2 d-flex p-2">
        <button class="btn btn-danger" @click="emergencyStop()">
        Stop!
        </button>
      </div>
      <div class="col-8 d-flex flex-row">
        <div class="d-flex flex-column justify-content-center" :class="{'border-primary':item===selectedLoco}"
          v-for="item in roster" 
          :key="item.id"
        >
          <button class="btn btn-sm btn-text-primary" @click="selectedLoco=item">{{ item.label }}</button>
          <span class="fs-sm">{{ item.speed }} {{ item.direction }}</span>
          <button class="btn btn-sm btn-outline-danger" @click="stopLoco(item)">Stop</button>
        </div>
      </div>
      <div class="col-2 d-flex p-2">
        <button class="btn btn-secondary" @click="resetSwitches()">
          Reset Points
        </button>
      </div>
    </div>
    <div class="row h-70">
      <div class="col-9 d-flex flex-column">
        <div class="svg-container flex-fill" ref="svgContainer" v-html="layoutPlan">
          
        </div>
        <div class="text-left fs-sm">
          <div>{{connectionInfo}}</div>
          <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="simulatedPin" />
          <button class="btn btn-sm " @click="onPinChanged(simulatedPin, 1)">Hi</button>
          <button class="btn btn-sm " @click="onPinChanged(simulatedPin, 0)">Lo</button>
       
        </div>
      </div>
      <div class="col-3 d-flex flex-column  align-items-center  justify-content-center">
       
        <div class="fw-bold">{{selectedLoco?.label || "Select loco"}}</div>
        <template v-if="selectedLoco">

           <!-- Tab Navigation -->
        <ul class="nav nav-tabs" id="myTab" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="tab1-tab" data-bs-toggle="tab" data-bs-target="#tab1" type="button" role="tab" aria-controls="tab1" aria-selected="true">Control</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="tab2-tab" data-bs-toggle="tab" data-bs-target="#tab2" type="button" role="tab" aria-controls="tab2" aria-selected="false">Route</button>
            </li>
        </ul>

          <!-- Tab Content -->
          <div class="tab-content mt-3" id="myTabContent">
              <div class="tab-pane fade show active" id="tab1" role="tabpanel" aria-labelledby="tab1-tab">
                <div class="btn-group m-1" role="group" aria-label="Basic radio toggle button group">
                <input type="radio" class="btn-check" name="btnradio" id="btnradio1" autocomplete="off"
                v-model="selectedLoco.direction" 
                :value="0"
                :disabled="!selectedLoco" @change="updateSpeedDirection(selectedLoco)">
                <label class="btn btn-outline-primary p-1 px-2" for="btnradio1">&lt;</label>

                <input type="radio" class="btn-check" name="btnradio" id="btnradio2" autocomplete="off" 
                v-model="selectedLoco.direction" 
                :value="1"
                :disabled="!selectedLoco" @change="updateSpeedDirection(selectedLoco)">
                <label class="btn btn-outline-primary p-1 px-2" for="btnradio2">&gt;</label>
              </div>
              <div class="">
                  <input type="range" min="0" max="125" v-model="selectedLoco.speed" 
                  id="simpleRange" :disabled="!selectedLoco"  @change="updateSpeedDirection(selectedLoco)">

                  <div class="value-display" id="rangeValue" >{{selectedLoco.speed}}</div>
              </div>
              <button class="btn btn-sm btn-outline-danger" @click="stopLoco(selectedLoco)">Stop</button>
              <div class="">
                <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="selectedLocoLocations" />
              </div>
              </div>
              <div class="tab-pane fade" id="tab2" role="tabpanel" aria-labelledby="tab2-tab">
                <div class="d-flex">
                  <button class="btn btn-sm btn-outline-secondary" @click="setLocoRouteStart(selectedLoco)">{{ locoRouteStartDesc }}</button>
                  <button class="btn btn-sm btn-outline-secondary" @click="setLocoRouteEnd(selectedLoco)">{{ locoRouteEndDesc }}</button>
                </div>

                <div v-if="selectedLoco.route.path">
                  <div v-for="step in selectedLoco.route.path" :key="step.id" class="row">
                    <div class="col-4">{{ step.type }}</div>
                    <div class="col-4">{{ step.id }}</div>
                    <div class="col-4">{{ step.direction }}</div>
                  </div>
                </div>
                <div v-else>
                  Create route
                </div>
              </div>
          </div>
          
          
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import layoutPlan from './assets/RailroadPlan_complete.svg?raw';
export default {
  name: 'App', // Component name
  data() {
    return {
      connectionInfo:"Not connected",
      isConnected:false,
      simulatedPin:null,
      serialOutput:"",
      layoutPlan: layoutPlan,
      selectedElementId: '',
      svgElementIds: [],
      selectedLoco:null,
      selectedPinInfo:null,
      pinLookup:{},
      turnoutLookup:{},
      roster:[
        {
          id:3,
          label:"Flying Scotsman",
          speed:0,
          direction:1,
          locations:[0,1],
          route:{
            start:null,
            end:null,

          }
        },
      ]
    };
  },
  methods: {
    onPinChanged(pin, state) {
      let me=this;
      const pinInfo=me.pinLookup[pin];
      if (!pinInfo) return;

      pin=pinInfo.pin;

      me.setLineStoke(pinInfo.element, state?5:3, state?"red":"green")
      

      if (state===0) {

        me.roster.forEach(d=> {
          d.locations = d.locations.filter(d=>d!==pin)
        });

        return;
      }

      const possibleMatches={fwd:[], back:[]};



      Object.keys(me.pinLookup).forEach(key => {
        const value=me.pinLookup[key]
        if (value.forward.connections.includes(pin)) {
          possibleMatches.fwd.push(value);
        }
        if (value.backward.connections.includes(pin)) {
          possibleMatches.back.push(value);
        }
        
      });
      
      console.log(`Possible fwd: ${possibleMatches.fwd.reduce((a, d) => a+","+d.pin,"")}, 
          back: ${possibleMatches.back.reduce((a, d) => a+","+d.pin,"")}`)

      me.roster.forEach(d=> {
          if (!d.speed) return;

          if (d.direction===1) {
            possibleMatches.fwd.forEach(pinInfo=>{
              if (d.locations.includes(pinInfo.pin)) {
                 console.log(`Possible fwd loco ${d.label}`);
                 d.locations.push(pin);
              }
            });
          } else {
            possibleMatches.back.forEach(pinInfo=>{
              if (d.locations.includes(pinInfo.pin)) {
                 console.log(`Possible back loco ${d.label}`);
                 d.locations.push(pin);
              }
            });
          }
          //d.locations = d.locations.filter(d=!pin);
      });

      
    },  
    createPinLookupMap() {
        let me=this;
        const svg = me.$refs.svgContainer?.querySelector('svg');
        if (!svg) return {};

        const pinlookupMap = {};

        const turnoutlookupMap = {};
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
              pinlookupMap[pathInfo.id] = {
                  element: element,
                  id: pathInfo.id,
                  pin: pathInfo.id,
                  forward: pathInfo.forward,
                  backward: pathInfo.backward
              };
              me.addPathLabel(element, pathInfo.id);

              element.addEventListener('click', function(event) {
                const pinInfo=me.pinLookup[pathInfo.id];
                if (pinInfo) {
                  me.selectedPinInfo=pinInfo;
                  
                }
              });

              element.addEventListener('mouseover', function(event) {
                const pinInfo=me.pinLookup[pathInfo.id];
                if (pinInfo) {
                  me.setLineStoke(pinInfo.element, 6);
                  pinInfo.forward.connections && pinInfo.forward.connections.forEach((d,i)=>{
                    const adjacencyPinInfo=me.pinLookup[d]
                    me.setLineStoke(adjacencyPinInfo.element, i==0?12:8);
                  })
                  pinInfo.backward.connections && pinInfo.backward.connections.forEach((d,i)=>{
                    const adjacencyPinInfo=me.pinLookup[d]
                    me.setLineStoke(adjacencyPinInfo.element, i==0?12:8);
                  })
                  
                }
              });

              // Add a mouseout event to revert the changes when the mouse leaves
              element.addEventListener('mouseout', function(event) {
                const pinInfo=me.pinLookup[pathInfo.id];
                if (pinInfo) {
                  me.setLineStoke(pinInfo.element, 3);
                  pinInfo.forward.connections && pinInfo.forward.connections.forEach(d=>{
                    const adjacencyPinInfo=me.pinLookup[d]
                    me.setLineStoke(adjacencyPinInfo.element, 3);
                  })
                  pinInfo.backward.connections && pinInfo.backward.connections.forEach(d=>{
                    const adjacencyPinInfo=me.pinLookup[d]
                    me.setLineStoke(adjacencyPinInfo.element, 3);
                  })
                }
              });

            } else if (element.tagName.toLowerCase() === "ellipse") {
              const turnout=me.parseTurnoutDescString(descValue);
              if (turnout) {
                turnoutlookupMap[turnout.vpin] = {
                  element: element,
                  turnout: turnout
                };
                me.setUpTurnoutDisplay(turnoutlookupMap[turnout.vpin]);
              }
            } 
            
        });
       
        me.pinLookup=pinlookupMap;
        me.turnoutLookup=turnoutlookupMap;


    },

    setUpTurnoutDisplay(turnoutInfo) {
      let me=this;
      let ellipse=turnoutInfo.element;
      let turnout=turnoutInfo.turnout;

      const cx = ellipse.getAttribute('cx');
      const cy = ellipse.getAttribute('cy');
      const rx = ellipse.getAttribute('rx');
      const ry = ellipse.getAttribute('ry');

      // Create transparent, larger ellipse for click area
      const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      hitbox.setAttribute('cx', cx);
      hitbox.setAttribute('cy', cy);
      hitbox.setAttribute('rx', parseFloat(rx) + 20); // Larger than visible ellipse
      hitbox.setAttribute('ry', parseFloat(ry) + 20);
      hitbox.setAttribute('fill', 'transparent');
      hitbox.setAttribute('stroke', 'transparent');
      hitbox.style.pointerEvents = 'all'; // Make it clickable

      ellipse.style.pointerEvents = 'none'; // Make it clickable

      // Attach click event to hitbox
      hitbox.addEventListener('click', () => {
        turnout.state=turnout.state==0?1:0;
  
       
        me.setTurnoutState(turnoutInfo)

      });

      

      // Insert hitbox BEFORE visible ellipse so it doesn't cover it
      const parent = ellipse.parentNode; // Get actual parent node
      parent.insertBefore(hitbox, ellipse); // Insert relative to the correct parent
      me.setTurnoutState(turnoutInfo);
    },


    async requestRoster() {
      let me=this;
      const response = await window.electronAPI.requestRoster();
      console.log("Roster Response:", response);
      this.roster = response;
    },

    stopLoco(loco) {
      loco.speed=0;
      this.setCabSpeed(loco);
    },
    
    updateSpeedDirection(loco) {
      this.setCabSpeed(loco);
    },
    setCabSpeed(loco) {
      let me=this;
      window.electronAPI.setCabSpeed(loco.id, loco.speed, loco.direction)
        .then((response) => {
          me.addSerialOutput(`Cab Speed Response: ${response}`);
        });
    },
    setLocoRouteStart(loco) {
      let me=this;
      loco.route.start=me.selectedPinInfo && me.selectedPinInfo.pin;
      if (loco.route.start && loco.route.end) {
        loco.route.path=me.findShortestPath(me.pinLookup, loco.route.start, loco.route.end);
        me.renderRoute(loco);
      }
    },
    setLocoRouteEnd(loco) {
      let me=this;
      loco.route.end=me.selectedPinInfo && me.selectedPinInfo.pin;
      if (loco.route.start && loco.route.end) {
        loco.route.path=me.findShortestPath(me.pinLookup, loco.route.start, loco.route.end);
        me.renderRoute(loco);
      }
    },


    renderRoute(loco) {
      let me=this;
      me.resetPathStrokes();
      if (!loco || !loco.route.path) return;
      const pathLength=loco.route.path.length;

      loco.route.path.forEach((step,i)=>{
        let pinInfo=me.pinLookup[step.id];
        if (!pinInfo) return;

        me.setLineStoke(pinInfo.element, i==0 || i==pathLength-1?8:6, "green");
      });

    },
    resetPathStrokes() {
      let me=this;
      Object.keys(me.pinLookup).forEach(key => {
        const pinInfo=me.pinLookup[key]
        me.setLineStoke(pinInfo.element, 4, "black");
      });
    },

    emergencyStop() {
      let me=this;
      window.electronAPI.emergencyStop().then((response) => {
         me.addSerialOutput(`Emergency Stop: ${response}`);
      });
      me.roster.forEach((loco) => {
        loco.speed=0;
      });
    },
    setPinValue() {
      let me=this;
      window.electronAPI.setPinValue(this.pinNumber, this.pinValue).then((response) => {
         me.addSerialOutput(`Set Pin Response: ${response}`);
      });
    },
    queryPinStatus() {
      let me=this;
      window.electronAPI.queryPinStatus().then((response) => {
         me.addSerialOutput(`Pin Status: ${response}`);
      });
    },
    resetSwitches() {
      let me=this;
      if (!me.turnoutLookup) return;
      for (const [key, value] of Object.entries(me.turnoutLookup)) {
        value.turnout.state=1;
        me.setTurnoutState(value);
      }
    },
    setTurnoutState(turnoutInfo) {
      let me=this;
      let ellipse=turnoutInfo.element;
      let turnout=turnoutInfo.turnout;

      ellipse.style.fill = ( turnout.state==0 ? 'blue' : 'red');
      if (!me.isConnected) return;
      window.electronAPI.setTurnoutState(turnout.vpin, turnout.state).then((response) => {
        me.addSerialOutput(`Turnout Response: ${response}`);
      });
    },
    addSerialOutput(msg) {
      if (!msg) return;
      this.serialOutput=msg+"<br/>"+this.serialOutput;
    },

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
                //straight: straight || null,
                //diverging: diverging || null
            };
        }

        return {
          id,
            forward: parseConnection(forwardData),
            backward: parseConnection(backwardData)
        };
    },

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
    },


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
    },

    addPathLabel(path, labelText) {
       // Get the total length of the path
      const pathLength = path.getTotalLength();

      // Calculate the midpoint along the path (half the total length)
      const midpoint = path.getPointAtLength(pathLength / 2);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');

      // Set the label's position at the midpoint coordinates
      label.setAttribute('x', midpoint.x-10);
      label.setAttribute('y', midpoint.y+5);

      // Set the text content for the label
      label.textContent = labelText;

      // Set some styles for the label
      label.setAttribute('font-size', '13');
      label.setAttribute('fill', 'black');

      // Create a background rectangle element for the label
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

      // Set the background rectangle attributes
      background.setAttribute('x', midpoint.x - 15); // Position it slightly to the left
      background.setAttribute('y', midpoint.y - 7); // Position it slightly above the label
      background.setAttribute('width', 30); // Width of the background rectangle
      background.setAttribute('height', 14); // Height of the background rectangle
      background.setAttribute('fill', 'white'); // Background color
      background.setAttribute('stroke', 'black'); // Optional border for the background

      // Append the background rectangle and label to the SVG element
      document.querySelector('svg').appendChild(background);
      document.querySelector('svg').appendChild(label);
    },
    findShortestPath(pinLookup, startId, endId) {
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
                    if (visitedPoints[steps[i]]) {
                        combinedSteps.push({ type: 'point', id: visitedPoints[steps[i]].pointId, direction: visitedPoints[steps[i]].direction });
                    }
                    combinedSteps.push({ type: 'segment', id: steps[i], direction: 'forward', length: pinLookup[steps[i]]?.length || 10 });
                }
                
                if (visitedPoints[id]) {
                    combinedSteps.push({ type: 'point', id: visitedPoints[id].pointId, direction: visitedPoints[id].direction });
                }
                combinedSteps.push({ type: 'segment', id: id, direction: 'forward', length: pinLookup[id]?.length || 10 });
                
                return combinedSteps;
            }
            
            if (visited.has(id) && visited.get(id) <= totalLength) continue;
            visited.set(id, totalLength);
            
            const node = pinLookup[id];
            if (!node) continue;
            
            // Always prioritize forward connections first
            const forwardNeighbors = node.forward.connections.map(conn => ({ conn, direction: 'forward', usedBackward, length: pinLookup[conn]?.length || 10 }));
            let backwardNeighbors = [];
            
            // Allow backward connections only if necessary
            if (allowBackward) {
                backwardNeighbors = node.backward.connections.map(conn => ({ conn, direction: 'backward', usedBackward: true, length: pinLookup[conn]?.length || 10 }));
            }
            
            const neighbors = [...forwardNeighbors, ...backwardNeighbors];
            
            for (const { conn, direction, usedBackward, length } of neighbors) {
                if (!visited.has(conn) || visited.get(conn) > totalLength + length) {
                    const newStep = [...steps, id];
                    const newVisitedPoints = { ...visitedPoints };
                    
                    // If this is a railway point (has two connections), determine its direction
                    if (node.forward.connections.length === 2) {
                        newVisitedPoints[id] = { pointId: node.forward.pointId, direction: conn === node.forward.connections[0] ? 'straight' : 'diverging' };
                    }
                    
                    // Also mark points when passing through from the back
                    if (node.backward.pointId) {
                        newVisitedPoints[id] = { pointId: node.backward.pointId, direction: conn === node.backward.connections[0] ? 'straight' : 'diverging' };
                    }
                    
                    queue.push({ id: conn, steps: newStep, visitedPoints: newVisitedPoints, usedBackward, totalLength: totalLength + length });
                }
            }
        }
        return null; // No path found
    };

    // First, try finding a route without using backwards
    let route = findRoute(false);
    if (!route) {
        console.log(`No forward-only path found between ${startId} and ${endId}, allowing backward movement.`);
        route = findRoute(true);
    }
    
    return route;
},





    setLineStoke(svgElement, strokeWidth, color) {
     // const svgElement = this.$refs.svgContainer?.querySelector(`#${elementId}`);
      if (svgElement) {
        if (strokeWidth) svgElement.style.strokeWidth = strokeWidth;
        if (color) svgElement.style.stroke = color;
      } else {
        console.log(`Element with ID "${elementId}" not found.`);
      }



    }
  },
  computed: {

    locoRouteStartDesc() {
      const loco=this.selectedLoco;
      if (!loco || !loco.route.start) return "-";
      return loco.route.start;
    },
    locoRouteEndDesc() {
      const loco=this.selectedLoco;
      if (!loco || !loco.route.end) return "-";
      return loco.route.end;
    },
    // Getter for the computed property
    selectedLocoLocations: {
      get() {
        if (!this.selectedLoco) return '';
        return this.selectedLoco.locations.join(',');  // Convert array to comma-separated string
      },
      // Setter for the computed property
      set(value) {
        this.selectedLoco.locations = value
          .split(','); // Filter out invalid numbers
      }
    }
  },
  mounted() {
    // Listen for response from Electron
    /*
    window.electronAPI.onReceiveFromElectron((data) => {
      let me=this;
      let message=(data && data.msg) || "?";
      //console.log("Data received:"+data);
      me.serialOutput = message+"<br/>"+me.serialOutput;
    });

    window.electronAPI.onConnected((data) => {
      let me=this;
      me.connectionInfo="Connected to "+data.msg;
      me.requestRoster();
    });
    */
    let me=this;

    me.createPinLookupMap();
    window.electronAPI.onConnected((data) => {
      let me=this;
      me.connectionInfo="Connected to "+data;
      me.isConnected=true;
      setTimeout(()=>{ 
          let roster=me.requestRoster();
          console.log(`Roster:${roster}`);
        }, 2000)
    });

    window.electronAPI.onPinChanged((data) => {
      let me=this;
      //console.log(`onPinChanged:${data.pin} ${data.state}`);
      me.onPinChanged(data.pin,data.state );
      /*
      const pinInfo=me.pinLookup[data.pin];
      if (pinInfo) {
        me.setLineStoke(pinInfo.element, data.state?5:3, data.state?"red":"green")
      }
        */
    });

    window.electronAPI.onSerialData((event, id, data) => {
     

      if ("port-connected"===id) {
        me.connectionInfo="Connected to "+data;
        setTimeout(()=>{ 
          let roster=me.requestRoster();
          console.log(`Roster:${roster}`);
        }, 1000)
       
      } else {
        me.addSerialOutput(id+":"+data);
      }
    });
    


/*
    const svg = this.$refs.svgContainer?.querySelector('svg');
    const ellipses = svg.querySelectorAll('ellipse');

    ellipses.forEach((ellipse) => {
      const cx = ellipse.getAttribute('cx');
      const cy = ellipse.getAttribute('cy');
      const rx = ellipse.getAttribute('rx');
      const ry = ellipse.getAttribute('ry');

      // Create transparent, larger ellipse for click area
      const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      hitbox.setAttribute('cx', cx);
      hitbox.setAttribute('cy', cy);
      hitbox.setAttribute('rx', parseFloat(rx) + 20); // Larger than visible ellipse
      hitbox.setAttribute('ry', parseFloat(ry) + 20);
      hitbox.setAttribute('fill', 'transparent');
      hitbox.setAttribute('stroke', 'transparent');
      hitbox.style.pointerEvents = 'all'; // Make it clickable

      ellipse.style.pointerEvents = 'none'; // Make it clickable

      // Attach click event to hitbox
      hitbox.addEventListener('click', () => {
        const currentFill = ellipse.style.fill;
        ellipse.style.fill = ( currentFill === 'red' ? 'blue' : 'red');
        const descElement = ellipse.querySelector('desc'); // Access the <desc> tag
        if (descElement) {
          const descContent = descElement.textContent;
          console.log("Desc Content:", descContent);
          const turnout=me.parseTurnoutDescString(descContent);
          if (turnout) {
            console.log(`Clicked on ${turnout.vpin} - ${turnout.desc}`)
            me.setTurnoutState(turnout.vpin,ellipse.style.fill=== 'red' ? 1: 0)
          } else {
            console.log(`Could not parse ${descContent}`)
          }
        }
       
      });

      

      // Insert hitbox BEFORE visible ellipse so it doesn't cover it
      const parent = ellipse.parentNode; // Get actual parent node
      parent.insertBefore(hitbox, ellipse); // Insert relative to the correct parent

    });
    */
  },
};
</script>

<style scoped>
  .svg-container {
    border: 1px solid #ccc;
  }
  .svg-container :deep(svg) {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }


   .h-10 { height: 10%; }
   .h-20 { height: 20%; }
   .h-30 { height: 30%; }
   .h-60 { height: 60%; }
   .h-70 { height: 70%; }
   .h-80 { height: 80%; }


   input[type="range"] {
            writing-mode: vertical-lr; 
            direction: rtl;
            width: 12px; /* Width of the slider */
            height: 200px; /* Height of the slider */
            background: #ddd;
            border-radius: 5px;
            outline: none;
        }
/*
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: #4CAF50;
            border-radius: 50%;
            cursor: pointer;
        }

        input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #4CAF50;
            border-radius: 50%;
            cursor: pointer;
        }
*/
        .value-display {
            /*margin-left: 20px;
            font-size: 1.2em;*/
        }

        
</style>
