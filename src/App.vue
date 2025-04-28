<template>
  <div class="w-100 h-100 row">
    <div class="col-9">
      <div class="row h-20 bg-light">
        <div class="col-2 ">

          <div class="d-flex flex-column justify-content-center">
            <i v-if="state.isConnected" class="bi bi-wifi text-success"></i>
            <i v-else class="bi bi-wifi-off text-secondary"></i>
          </div>


          <div class="d-flex flex-row justify-content-center align-items-start gap-2">
            <button class="btn btn-danger" @click="emergencyStop()">
              <i class="bi bi-exclamation-triangle"></i>
            </button>
            <button class="btn btn-secondary" @click="resetPoints()">
              <i class="bi bi-sign-merge-left"></i>
            </button>
          </div>

        </div>
        <div class="col-10 d-flex flex-row">
          <div class="d-flex flex-column justify-content-center" 
          :class="{'border-primary':item===state.selectedLoco}"
          :style="{'background-color':hexToRgba(item.color,0.1)}"
            v-for="item in state.roster" 
            :key="item.id"
          >
            <button class="btn btn-sm btn-text-primary" @click="state.selectedLoco=item">{{ item.label }}</button>
            
            <div class="d-flex flex-row justify-content-center">
            
              <template v-if=" item.speed>0">
                <a href="#" class="text-decoration-underline" @click.prevent="updateSpeedDirection(item,undefined,item.direction===1?0:1)">
                  <i v-if="item.direction===1" class="bi bi-arrow-up"></i>
                  <i v-if="item.direction===0" class="bi bi-arrow-down"></i>
                </a>
                {{ item.speed }}
                <a href="#" class="ms-2 text-danger text-decoration-underline" @click.prevent="stopLoco(item)">
                  <i class="bi bi-sign-stop"></i>
                </a>
              </template>
              <template v-else>
                <a href="#" class="text-decoration-underline" @click.prevent="updateSpeedDirection(item,50)">
                Go!
                </a>
              </template>
            </div>
            <div class="d-flex flex-row justify-content-center">
              <i v-if="item.route.path" class="bi bi-signpost"></i>
              <i v-if="!item.locations || !item.locations.length" class="bi bi-question"></i>
            </div>
          </div>
        </div>
        
      </div>
      <div class="row h-70 position-relative">
        <div v-if="view==='map'" class="position-absolute top-0 end-0 p-2">
          <a  href="#" class="text-decoration-underline small text-end d-block" @click="view='log'">Log</a>
        </div>
        <div v-show="view==='map'" class="svg-container flex-fill" ref="svgContainer" v-html="layoutPlan"></div>
      
        <div v-if="view==='log'">
          <a href="#" class="text-decoration-underline  small text-end d-block" @click="view='map'">← back to map</a>
          <div class="table-responsive small" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-sm table-striped mb-0">
              <thead class="table-light sticky-top">
                <tr>
                  <th>Time</th>
                  <th>Source</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in state.logEntries" :key="entry.timestamp">
                  <td>{{ entry.timestamp }}</td>
                  <td>{{ entry.source }}</td>
                  <td>{{ entry.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      
      </div>
    </div>
    <div class="col-3 d-flex flex-column  align-items-center  justify-content-center">
       
        <div class="fw-bold mb-1">{{state.selectedLoco?.label || "Select loco"}}</div>
           <!-- Tab Navigation -->
          <ul class="nav nav-tabs flex-nowrap" id="myTab" role="tablist">
              <li class="nav-item" role="presentation" >
                  <button class="nav-link px-1 active" id="tab1-tab" data-bs-toggle="tab"  data-bs-target="#tab1" type="button" role="tab" aria-controls="tab1" aria-selected="true">Control</button>
              </li>
              <li class="nav-item" role="presentation">
                  <button class="nav-link px-1" id="tab2-tab" data-bs-toggle="tab" data-bs-target="#tab2" type="button" role="tab" aria-controls="tab2" aria-selected="false">Route</button>
              </li>
          </ul>
       
          <!-- Tab Content -->
          <div class="tab-content mt-3 h-100" id="myTabContent">
            <template v-if="state.selectedLoco">
              <div class="tab-pane fade show active" id="tab1" role="tabpanel" aria-labelledby="tab1-tab">
                <div class="btn-group m-1" role="group" aria-label="Basic radio toggle button group">
                  <input type="radio" class="btn-check" name="btnradio" id="btnradio1" autocomplete="off"
                  v-model="state.selectedLoco.direction" 
                  :value="0"
                  :disabled="!state.selectedLoco" @change="updateSpeedDirection(state.selectedLoco)">
                  <label class="btn btn-outline-primary p-1 px-2" for="btnradio1">&lt;</label>

                  <input type="radio" class="btn-check" name="btnradio" id="btnradio2" autocomplete="off" 
                  v-model="state.selectedLoco.direction" 
                  :value="1"
                  :disabled="!state.selectedLoco" @change="updateSpeedDirection(state.selectedLoco)">
                  <label class="btn btn-outline-primary p-1 px-2" for="btnradio2">&gt;</label>
                </div>
                <div class="">
                    <input type="range" min="0" max="125" v-model="state.selectedLoco.speed" 
                    id="simpleRange" :disabled="!state.selectedLoco"  @change="updateSpeedDirection(state.selectedLoco)">

                    <div class="value-display" id="rangeValue" >{{state.selectedLoco.speed}}</div>
                </div>
                <button class="btn btn-sm btn-outline-danger" @click="stopLoco(state.selectedLoco)">Stop</button>
                <div class="">
                  <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="selectedLocoLocations" />
                </div>
              </div>
              <div class="tab-pane fade" id="tab2" role="tabpanel" aria-labelledby="tab2-tab">
                <div class="d-flex">
                  <button class="btn btn-sm btn-outline-secondary" @click="setLocoRouteStart(state.selectedLoco)">{{ locoRouteStartDesc }}</button>
                  <button class="btn btn-sm btn-outline-secondary" @click="setLocoRouteEnd(state.selectedLoco)">{{ locoRouteEndDesc }}</button>
                  <button class="btn btn-sm btn-outline-secondary" :enabled="hasRoute" @click="reverseRoute(state.selectedLoco)">Reverse</button>
                  <button class="btn btn-sm btn-outline-secondary" :enabled="hasRoute" @click="clearRoute(state.selectedLoco)">Clear</button>
                </div>
                <div class="d-flex">
                  <button class="btn btn-sm btn-outline-secondary" @click="startRoute(state.selectedLoco)">Start</button>
                  <button class="btn btn-sm btn-outline-secondary" @click="simulateNext()">Sim next</button>
                
                  <button class="btn btn-sm btn-outline-secondary" @click="setPointsForRoute(state.selectedLoco)">Set points</button>
                </div>

                <div v-if="state.selectedLoco.route.path">
                  <div v-for="step in state.selectedLoco.route.path" :key="step.id" class="row fs-sm">
                    <div class="col-4">{{ step.type }}</div>
                    <div class="col-4">{{ step.id }}</div>
                    <div class="col-4">{{ step.direction }}</div>
                  </div>
                </div>
                <div v-else>
                  Create route
                </div>
              </div>
            </template>
          </div>
          

          <div class="d-flex flex-row fs-sm">
            <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="state.simulatedPin" />
            <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 1)">Hi</button>
            <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 0)">Lo</button>
          </div>
        </div>
  </div>
</template>

<script>
import { reactive } from 'vue';
import Layout from "./lib/layout.js";
import { SvgUtils } from "./lib/SvgUtils.js";
import layoutPlan from './assets/RailroadPlan_complete.svg?raw';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default {
  name: 'App', // Component name
  data() {
    return {
      layout:Layout,
      state: reactive({
        connectionInfo:"Not connected",
        isConnected:false,
        serialOutput:"",
        logEntries: [],
        selectedLoco:null,
        roster: [],
        blockLookup:{},
        pointLookup:{},
      }),
      layoutPlan: layoutPlan,
      routeView:false,
      routeStep:0,
      view:'map',
    };
  },
  methods: {
    hexToRgba(hex, alpha) {
      return SvgUtils.hexToRgba(hex, alpha);
    },
    onPinChanged(pin, value) {
      this.layout.onPinChanged(pin, value);
    },
    
    updateSpeedDirection(loco, speed, direction) {
      if (speed !== undefined) loco.speed = speed;
      if (direction !== undefined) loco.direction = direction;
      this.layout.setCabSpeed(loco);
    },
    stopLoco(loco) {
      loco.speed=0;
      this.layout.setCabSpeed(loco);
    },
    emergencyStop() {
      this.layout.emergencyStop();
    },
    resetPoints() {
      this.layout.resetPoints();
    },
    reverseRoute(loco) {
      this.layout.reverseRoute(loco);
    },
    clearRoute(loco) {
      this.layout.clearRoute(loco);
    },
    startRoute(loco) {
      this.layout.startRoute(loco);
    },
    simulateNext() {
      this.layout.simulateNext();
    },
    setPointsForRoute(loco) {
      this.layout.setPointsForRoute(loco);
    },
    setLocoRouteStart(loco) {
      let me=this;
      me.selectedBlock && me.layout.setLocoRouteStart(loco,me.selectedBlock.id );
      
    },
    setLocoRouteEnd(loco) {
      let me=this;
      me.selectedBlock && me.layout.setLocoRouteEnd(loco,me.selectedBlock.id );
    },
   

       refreshSvgElementStyles() {
      let me=this;
      
      for (const [pointId, element] of Object.entries(me.elementLookup.points)) {
        const point=me.state.pointLookup[pointId];
        if (!point) {
          console.log(`Point info not found: ${pointId}`);
          continue;
        }
        element.style.fill = ( point.state===1 ? 'blue' : 'red');
      }
    },
    processSvgElements() {
      let me=this;
      
      for (const [pointId, element] of Object.entries(me.elementLookup.points)) {
        const point=me.state.pointLookup[pointId];
        if (!point) {
          console.log(`Point info not found: ${pointId}`);
          continue;
        }
        SvgUtils.configPointEllipse(element, () => {
          me.layout.setPointState(point,point.state===0?1:0);
          console.log(`Clicked on ${point.vpin} - ${point.desc}: ${point.state}`)
          me.refreshSvgElementStyles();

        });
      }

      for (const [blockId, element] of Object.entries(me.elementLookup.blocks)) {
        const block=me.state.blockLookup[blockId];
        if (!block) {
          console.log(`block info not found: ${blockId}`);
          continue;
        }
        me.configureBlockPath(element, block);
      }
    },
    configureBlockPath(path, block) {
      let me=this;
      SvgUtils.addPathLabel(path, block.id);
      SvgUtils.addPathClickTarget(path,function(event) {
       
        if (block) {
          me.selectedBlock=block;
          if (me.routeView && me.state.selectedLoco) {
            const loco=me.state.selectedLoco;
            if (loco.locations && loco.locations.length>0) {
              me.layout.setLocoRouteStart(loco,loco.locations[0]);
              me.layout.setLocoRouteEnd(loco,me.selectedBlock.id );
              return;
            }


            if (me.routeStep===0) {
              me.layout.setLocoRouteStart(loco,me.selectedBlock.id );
              me.routeStep=1;
            } else {
              me.layout.setLocoRouteEnd(loco,me.selectedBlock.id );
              me.routeStep=0;
            }
          } else {
            me.onPinChanged(block.id, block.value === 0 ? 1 : 0);
          }
        }
      });
      
    },
   
    resetBlockFormats() {
      let me=this;
      for (const [blockId, element] of Object.entries(me.elementLookup.blocks)) {
        const block=me.state.blockLookup[blockId];
        const isOccupied=me.state.roster.reduce((a,d)=>a || d.locations.includes(blockId), false);


        SvgUtils.setLineStoke(element, isOccupied?6:4, isOccupied?"red":"green");
      } 
    },
    refreshBlocks() {
      const LOCO_ROUTE_CLASS="loco-route";
      let me=this;
      me.resetBlockFormats();
      SvgUtils.removeSvgElementsByClass(LOCO_ROUTE_CLASS);

      const blockWithRoute=me.layout.getBlocksWithRoute();
      for (const [blockId, locos] of Object.entries(blockWithRoute)) {
        const element=me.elementLookup.blocks[blockId];
        if (!element) continue;
        locos.forEach((loco,i)=>{
          if (loco!==me.state.selectedLoco) return;
          SvgUtils.addBackgroundStroke(element,loco.color, 8, LOCO_ROUTE_CLASS);
          
        });
      }
      
    },
   
  },
  computed: {
    hasRoute() {
      const loco=this.state.selectedLoco;
      return loco && loco.route.path;
    },
    locoRouteStartDesc() {
      const loco=this.state.selectedLoco;
      if (!loco || !loco.route.start) return "-";
      return loco.route.start;
    },
    locoRouteEndDesc() {
      const loco=this.state.selectedLoco;
      if (!loco || !loco.route.end) return "-";
      return loco.route.end;
    },
    // Getter for the computed property
    selectedLocoLocations: {
      get() {
        if (!this.state.selectedLoco) return '';
        return this.state.selectedLoco.locations.join(',');  // Convert array to comma-separated string
      },
      // Setter for the computed property
      set(value) {
        this.state.selectedLoco.locations = value
          .split(','); // Filter out invalid numbers
      }
    },

  },

  watch: {
    'state.roster': {
      deep: true,
      handler(newRoster) {
        this.refreshBlocks();
 
      }
    },
    'state.selectedLoco': {
      deep: true,
      handler(newLoco) {
        this.refreshBlocks();

      }
    },
    'state.pointLookup': {
      deep: true,
      handler(newLoco) {
        this.refreshSvgElementStyles();
    
      }
    },
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
    const tab1El = document.getElementById('tab1-tab');
    tab1El.addEventListener('shown.bs.tab', () => {
      this.routeView = false;
    });
    const tab2El = document.getElementById('tab2-tab');
    tab2El.addEventListener('shown.bs.tab', () => {
      this.routeView = true;
    });
    let me=this;
    const svg = me.$refs.svgContainer?.querySelector('svg');
    me.layout=new Layout(me.state);
    me.layout.init();
    

    me.elementLookup=me.layout.processLayoutSvg(svg);
    me.processSvgElements();
    
    
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
