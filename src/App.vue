<template>
  <div class="w-100 h-100 row">
    <div class="col-2 col-md-1 d-flex flex-column align-items-center justify-content-start pt-2">
      <i v-if="state.isConnected" class="bi bi-wifi text-success"></i>
      <i v-else class="bi bi-wifi-off text-secondary"></i>

      <button class="btn btn-danger mt-3" @click="emergencyStop()">
        <i class="bi bi-exclamation-triangle"></i>
      </button>
      <button class="btn btn-secondary mt-2" @click="resetPoints()">
        <i class="bi bi-sign-merge-left"></i>
      </button>
      <button class="btn btn-secondary mt-2" @click="queryPinStatus()">
        <i class="bi bi-pin"></i>
      </button>
      <button class="btn btn-secondary mt-2" @click="requestRoster()">
        <i class="bi bi-arrow-repeat"></i>
      </button>
      <button
        class="btn btn-link p-0 m-0 mt-2"
        :class="{'text-success': state.isAllowSpeedOverride, 'text-secondary': !state.isAllowSpeedOverride}"
        @click="state.isAllowSpeedOverride = !state.isAllowSpeedOverride"
        type="button"
        id="speedOverrideToggle"
        title="Toggle Speed Override"
        style="font-size: 1.3rem;"
      >
        <i :class="state.isAllowSpeedOverride ? 'bi bi-toggle-on' : 'bi bi-toggle-off'"></i>
      </button>
    </div>
    <div class="col-10 col-md-11 ">
      <div class="row h-20 bg-light">
        
        <div class="col-10 d-flex flex-row">
          <div class="d-flex flex-column justify-content-center" 
          :class="{'border-primary':item===state.selectedLoco}"
          :style="{'background-color':hexToRgba(item.color,0.1)}"
            v-for="item in state.roster" 
            :key="item.id"
          >
            <button class="btn btn-sm btn-text-primary" @click="showLocoControllerPopup(item, $event)">{{ item.label }}</button>
            
            <div class="d-flex flex-row justify-content-center">
            
              <template v-if=" item.speed>0">
                <a href="#" class="text-decoration-underline" @click.prevent="updateSpeedDirection(item,undefined,item.direction===1?0:1)">
                  <i v-if="item.direction===1" class="bi bi-arrow-up"></i>
                  <i v-if="item.direction===0" class="bi bi-arrow-down"></i>
                </a>
                {{ item.adjustedSpeed || 0 }} / {{ item.speed || 0 }}
                <a href="#" class="ms-2 text-danger text-decoration-underline" @click.prevent="stopLoco(item)">
                  <i class="bi bi-sign-stop"></i>
                </a>
              </template>
              <template v-else>
                <a href="#" class="text-decoration-underline" @click.prevent="updateSpeedDirection(item,50)">
                -
                </a>
              </template>
            </div>
            <div class="d-flex flex-row justify-content-center">
              <i v-if="item.route.path" class="bi bi-signpost"></i>
              <i v-if="!item.hasPosition()" class="bi bi-question"></i>
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
          <a href="#" class="text-decoration-underline  small text-end d-block" @click="view='map'">← Map</a>
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
          <a href="#" class="text-decoration-underline small text-end d-block mb-2" @click.prevent="state.logEntries = []">Clear log</a>
          
        </div>
      
      </div>
    </div>
    <!--
    <div class="col-3 d-flex flex-column  align-items-center  justify-content-center">
       
        <div class="fw-bold mb-1">{{state.selectedLoco?.label || "Select loco"}}</div>
         
          <ul class="nav nav-tabs flex-nowrap" id="myTab" role="tablist">
              <li class="nav-item" role="presentation" >
                  <button class="nav-link px-1 active" id="tab1-tab" data-bs-toggle="tab"  data-bs-target="#tab1" type="button" role="tab" aria-controls="tab1" aria-selected="true">Control</button>
              </li>
              <li class="nav-item" role="presentation">
                  <button class="nav-link px-1" id="tab2-tab" data-bs-toggle="tab" data-bs-target="#tab2" type="button" role="tab" aria-controls="tab2" aria-selected="false">Route</button>
              </li>
              <li class="nav-item" role="presentation">
                  <button class="nav-link px-1" id="tab3-tab" data-bs-toggle="tab" data-bs-target="#tab3" type="button" role="tab" aria-controls="tab3" aria-selected="false">Debug</button>
              </li>
          </ul>
       
         
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
                <div class="d-flex flex-row">
                  <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="enteredLocoLocations"  @keydown.enter="onLocationEntered"/>
                  {{ selectedLocoLocations }}
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
              <div class="tab-pane fade" id="tab3" role="tabpanel" aria-labelledby="tab3-tab">
                <pre class="d-flex flex-row fs-xs">{{ selectedLocoPosition }}</pre>
                <div v-if="state.selectedLoco.blockHistory" class="table-responsive small" style="max-height: 300px; overflow-y: auto;">
                  <table class="table table-sm table-striped mb-0">
                    <thead class="table-light sticky-top">
                    <tr>
                      <th>Block</th>
                      <th>Enter</th>
                      <th>Exit</th>
                      <th>Time in Block (s)</th>
                      <th>Speed (px/s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, index) in state.selectedLoco.blockHistory" :key="index">
                      <td>{{ entry.blockId }}</td>
                      <td>{{ formatTime(entry.time) }}</td>
                      <td>{{ formatTime(entry.exitTime) }}</td>
                      <td>{{ formatDuration(entry.duration) }}</td>
                      <td>{{ formatSpeed(entry.speed) }}</td>
                    </tr>
                  </tbody>
                </table>
                <table class="table table-striped table-bordered table-sm text-nowrap small">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>Visits</th>
                      <th>Avg Spd</th>
                      <th>Min Spd</th>
                      <th>Max Spd</th>
                      <th>Avg Duration (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="stat in state.selectedLoco.getBlockSpeedStats()" :key="stat.blockId">
                      <td>{{ stat.blockId }}</td>
                      <td>{{ stat.visits }}</td>
                      <td>{{ stat.avgSpeed }}</td>
                      <td>{{ stat.minSpeed }}</td>
                      <td>{{ stat.maxSpeed }}</td>
                      <td>{{ stat.avgDuration }}</td>
                      <td>{{ stat.totalTime }}</td>
                    </tr>
                  </tbody>
                </table>

                <button class="btn btn-sm btn-text-primary" @click="state.selectedLoco.clearBlockHistory()">Clear</button>
           
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
      -->
        <div v-if="state.matchLocoModal.show" class="modal fade show d-block" tabindex="-1" style="background:rgba(0,0,0,0.5);">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Assign a Loco to Block {{ state.matchLocoModal.pin }}</h5>
                <button type="button" class="btn-close" @click="state.matchLocoModal.show = false"></button>
              </div>
              <div class="modal-body">
                <ul class="list-group mb-3">
                  <li
                    v-for="loco in [...state.roster.filter(l => !l.hasPosition()), ...state.roster.filter(l => l.hasPosition())]"
                    :key="loco.id"
                    class="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <button class="btn btn-outline-primary btn-sm flex-grow-1 text-start"
                      @click="onLocationEntered(loco, [state.matchLocoModal.pin]); state.matchLocoModal.show = false;">
                      {{ loco.label }}
                      <span v-if="loco.hasPosition()" class="text-muted small">
                        (currently at {{ loco.trainPosition?.startBlockId }})
                      </span>
                    </button>
                  </li>
                </ul>
                <button class="btn btn-secondary w-100" @click="state.matchLocoModal.show = false">Cancel</button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="state.locoControllerPopup.show"
          ref="locoControllerPopup"
          class="position-absolute bg-white border rounded shadow p-3"
          :style="{
            top: state.locoControllerPopup.position.top + 'px',
            left: state.locoControllerPopup.position.left + 'px',
            zIndex: 1050,
            
            width: '200px',
          }"
        >
          <!-- Controller content, reuse your existing controller markup -->
          <div>
            <div class="fw-bold mb-1">{{state.locoControllerPopup.loco.label}}</div>
          
           <!-- Tab Navigation -->
          <ul class="nav nav-tabs flex-nowrap" id="myTab" role="tablist">
              <li class="nav-item" role="presentation" >
                  <button class="nav-link px-1 active" id="tab1-tab" data-bs-toggle="tab"  data-bs-target="#tab1" type="button" role="tab" aria-controls="tab1" aria-selected="true">Control</button>
              </li>
              <li class="nav-item" role="presentation">
                  <button class="nav-link px-1" id="tab2-tab" data-bs-toggle="tab" data-bs-target="#tab2" type="button" role="tab" aria-controls="tab2" aria-selected="false">Route</button>
              </li>
              <li class="nav-item" role="presentation">
                  <button class="nav-link px-1" id="tab3-tab" data-bs-toggle="tab" data-bs-target="#tab3" type="button" role="tab" aria-controls="tab3" aria-selected="false">Debug</button>
              </li>
          </ul>
       
          <!-- Tab Content -->
          <div class="tab-content mt-3 h-100" id="myTabContent">
            
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
              <div class="tab-pane fade" id="tab3" role="tabpanel" aria-labelledby="tab3-tab">
                <div class="d-flex flex-row">
                  <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="enteredLocoLocations"  @keydown.enter="onLocationEntered"/>
                  {{ selectedLocoLocations }}
                </div>
                <div class="d-flex flex-row fs-sm">
                  <input type="text" class="form-control form-control-sm" placeholder="Location" v-model="state.simulatedPin" />
                  <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 1)">Hi</button>
                  <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 0)">Lo</button>
                </div>

                <pre class="d-flex flex-row fs-xs">{{ selectedLocoPosition }}</pre>
                <div v-if="state.selectedLoco.blockHistory" class="table-responsive small" style="max-height: 300px; overflow-y: auto;">
                  <table class="table table-sm table-striped mb-0">
                    <thead class="table-light sticky-top">
                    <tr>
                      <th>Block</th>
                      <th>Enter</th>
                      <th>Exit</th>
                      <th>Time in Block (s)</th>
                      <th>Speed (px/s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, index) in state.selectedLoco.blockHistory" :key="index">
                      <td>{{ entry.blockId }}</td>
                      <td>{{ formatTime(entry.time) }}</td>
                      <td>{{ formatTime(entry.exitTime) }}</td>
                      <td>{{ formatDuration(entry.duration) }}</td>
                      <td>{{ formatSpeed(entry.speed) }}</td>
                    </tr>
                  </tbody>
                </table>
                <table class="table table-striped table-bordered table-sm text-nowrap small">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>Visits</th>
                      <th>Avg Spd</th>
                      <th>Min Spd</th>
                      <th>Max Spd</th>
                      <th>Avg Duration (s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="stat in state.selectedLoco.getBlockSpeedStats()" :key="stat.blockId">
                      <td>{{ stat.blockId }}</td>
                      <td>{{ stat.visits }}</td>
                      <td>{{ stat.avgSpeed }}</td>
                      <td>{{ stat.minSpeed }}</td>
                      <td>{{ stat.maxSpeed }}</td>
                      <td>{{ stat.avgDuration }}</td>
                      <td>{{ stat.totalTime }}</td>
                    </tr>
                  </tbody>
                </table>

                <button class="btn btn-sm btn-text-primary" @click="state.selectedLoco.clearBlockHistory()">Clear</button>
           
                </div>
              </div>
          </div>
          

          
          <!--<button class="btn btn-sm btn-outline-danger" @click="hideLocoControllerPopup()">Close</button>-->
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
        isAllowSpeedOverride:false,
        matchLocoModal: {
          show: false,
          pin: null
        },
        locoControllerPopup: {
          show: false,
          loco: null,
          position: { top: 0, left: 0 }
        },
      }),
      layoutPlan: layoutPlan,
      routeView:false,
      routeStep:0,
      view:'map',
      animationFrameId: null,
      enteredLocoLocations: "" // plain text user types
    };
  },
  methods: {
    handleClickOutside(event) {
      const popup = this.$refs.locoControllerPopup;
      if (
        this.state.locoControllerPopup.show &&
        popup &&
        !popup.contains(event.target)
      ) {
        this.hideLocoControllerPopup();
      }
    },
    showLocoControllerPopup(loco, event) {
      if (loco && loco.id === this.state.selectedLoco?.id) {
        this.hideLocoControllerPopup();
        return;
      } 

      // Get button position
      const rect = event.target.getBoundingClientRect();
      this.state.locoControllerPopup = {
        show: true,
        loco,
        position: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX
        }
      };
      this.state.selectedLoco = loco;
    },
    hideLocoControllerPopup() {
      this.state.locoControllerPopup.show = false;
      this.state.selectedLoco = null;
      this.state.locoControllerPopup.loco = null;
    },
    formatTime(timestamp) {
      if (!timestamp) return '—';
      const dt = new Date(timestamp);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
    },
    formatDuration(seconds) {
      return seconds != null ? seconds.toFixed(1) : '—';
    },
    formatSpeed(speed) {
      return speed != null ? speed.toFixed(1) : '—';
    },
    startAnimationLoop() {
      const loop = () => {
        this.layout?.state.roster.forEach(loco => {
          loco.updateTrainPosition();
          this.updateLocoSvgPosition(loco);
        });

        this.animationFrameId = requestAnimationFrame(loop); // Schedule next frame
      };
      this.animationFrameId = requestAnimationFrame(loop); // Start the loop
    },
    onLocationEntered(loco, blockIds) {
      loco = loco || this.state.selectedLoco;
      if (!loco) return;``
      blockIds = blockIds || this.enteredLocoLocations.split(',');
      blockIds.forEach(blockId => {
        if (blockId.trim()) {
          loco.blockLocationChanged(blockId.trim(), 1);
        }
      });
    },
    hexToRgba(hex, alpha) {
      return SvgUtils.hexToRgba(hex, alpha);
    },
    onPinChanged(pin, value) {
      this.layout.onPinChanged(pin, value);
    },
    
    updateSpeedDirection(loco, speed, direction) {
      if (speed !== undefined) loco.speed = speed;
      if (direction !== undefined) loco.direction = direction;
      //loco.updateSpeedDirection();
    },
    stopLoco(loco) {
      loco.stop();
    },
    emergencyStop() {
      this.layout.emergencyStop();
    },
    resetPoints() {
      this.layout.resetPoints();
    },
    queryPinStatus() {
      this.layout.queryPinStatus();
    },
    requestRoster() {
      this.layout.requestRoster();
    },
    reverseRoute(loco) {
      loco.reverseRoute();
    },
    clearRoute(loco) {
      loco.clearRoute();
    },
    startRoute(loco) {
      loco.startRoute();
    },
    simulateNext() {
      this.layout.simulateNext();
    },
    setPointsForRoute(loco) {
      loco.setPointsForRoute();
    },
    setLocoRouteStart(loco) {
      let me=this;
      me.selectedBlock && loco.setRouteStart(me.selectedBlock.id );
      
    },
    setLocoRouteEnd(loco) {
      let me=this;
      me.selectedBlock && loco.setRouteEnd(me.selectedBlock.id );
    },
   
    updateLocoSvgPosition(loco) {
        const svg = document.querySelector(".svg-container svg");
        if (!svg) return;

        const blockLookup = this.state.blockLookup;
        const trainPos = loco.trainPosition;

        if (!trainPos.startBlockId || loco.numCarriages <= 0 || loco.length <= 0) return;

        const totalCarriages = loco.numCarriages;
        const spacing = loco.length / (totalCarriages - 1);

        const carriageOffsets = Array.from({ length: totalCarriages }, (_, i) => i * spacing);

        let markerIndex = 0;

        for (const distFromHead of carriageOffsets) {
            // ❗ Start fresh from head for each carriage
            let travel = distFromHead;
            let currentBlockId = trainPos.startBlockId;
            let currentOffset = trainPos.startOffset;

            while (currentBlockId && travel >= 0) {
                const block = blockLookup[currentBlockId];
                if (!block || !block.element) break;

                const pathElement = block.element;
                const pathLength = pathElement.getTotalLength();
                const logicalLength = block.length || 10;
                const reversed = block.pathReversed || false;

                // How much distance is available in this block in the walking direction
                const moveable = loco.direction === 1
                    ? currentOffset
                    : logicalLength - currentOffset;

                if (travel <= moveable) {
                    const logicalOffset = loco.direction === 1
                        ? currentOffset - travel
                        : currentOffset + travel;

                    const visualOffset = (logicalOffset / logicalLength) * pathLength;
                    const effectiveOffset = reversed
                        ? pathLength - visualOffset
                        : visualOffset;

                    const pt = pathElement.getPointAtLength(effectiveOffset);

                    let marker = svg.querySelector(`#loco-${loco.id}-carriage-${markerIndex}`);
                    if (!marker) {
                        marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        marker.setAttribute("id", `loco-${loco.id}-carriage-${markerIndex}`);
                        marker.setAttribute("r", "8");
                        marker.setAttribute("fill", loco.color || "blue");
                        svg.appendChild(marker);
                    }

                    marker.setAttribute("cx", pt.x);
                    marker.setAttribute("cy", pt.y);
                    markerIndex++;
                    break;
                } else {
                    // Move to next block in the tail direction
                    travel -= moveable;

                    currentBlockId = loco.direction === 1
                        ? this.layout.getActiveBackwardConnection(block)
                        : this.layout.getActiveForwardConnection(block);

                    const nextBlock = blockLookup[currentBlockId];
                    currentOffset = loco.direction === 1
                        ? (nextBlock?.length || 10)
                        : 0;
                }
            }
        }
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
            if (loco.hasPosition()) {
              loco.setRouteStart(loco.getStartBlockId());
              loco.setRouteEnd(me.selectedBlock.id );
              return;
            }


            if (me.routeStep===0) {
              loco.setRouteStart(me.selectedBlock.id );
              me.routeStep=1;
            } else {
              loco.setRouteEnd(me.selectedBlock.id );
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
        //const block=me.state.blockLookup[blockId];
        //const isOccupied=me.state.roster.reduce((a,d)=>a || d.isOccupyingBlock(blockId), false);
       const loco = me.layout.isBlockOccupied(blockId);

        SvgUtils.setLineStoke(element, loco?6:4, loco?(loco.color || "grey"):"green");
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
    selectedLocoPosition() {
      if (!this.state.selectedLoco) return '';
      return JSON.stringify(this.state.selectedLoco.trainPosition, (key, value) => {
      if (typeof value === 'number') {
        return Math.round(value * 10) / 10; 
      }
      return value;
    }, 2);
    },
    selectedLocoLocations() {
   
        if (!this.state.selectedLoco) return '';
        return this.state.selectedLoco.getOccupiedBlockIds()?.join(',');  // Convert array to comma-separated string
      
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
    /*
    const tab1El = document.getElementById('tab1-tab');
    tab1El.addEventListener('shown.bs.tab', () => {
      this.routeView = false;
    });
    const tab2El = document.getElementById('tab2-tab');
    tab2El.addEventListener('shown.bs.tab', () => {
      this.routeView = true;
    });
    */
    document.addEventListener('mousedown', this.handleClickOutside);

    let me=this;
    const svg = me.$refs.svgContainer?.querySelector('svg');
    me.layout=new Layout(me.state);
    me.layout.init();
    

    me.elementLookup=me.layout.processLayoutSvg(svg);
    me.processSvgElements();
    
    me.startAnimationLoop();
  },
  beforeUnmount() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('mousedown', this.handleClickOutside);

  },
};
</script>

<style scoped>

  table.table-sm td, table.table-sm th {
    font-size: 0.7rem;
  }
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
