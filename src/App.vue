<template>
  <div class="w-100 h-100 d-flex flex-row" :style="{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }">
    <div class="d-flex gap-3 flex-column align-items-center justify-content-start pt-2">
      <div class="p-2">      
        <i v-if="state.isConnected" class="bi bi-wifi text-success"></i>
        <i v-else class="bi bi-wifi-off text-secondary"></i>
      </div>

      <button class="btn btn-lg btn-danger" @click="emergencyStop()">
        <i class="bi bi-exclamation-triangle fs-2"></i>
      </button>

      <button class="btn btn-lg btn-secondary" @click="resetPoints()">
        <i class="bi bi-sign-merge-left fs-2"></i>
      </button>

      <button class="btn btn-lg btn-secondary" @click="queryPinStatus()">
        <i class="bi bi-pin fs-2"></i>
      </button>

      <button class="btn btn-lg btn-secondary" @click="requestRoster()">
        <i class="bi bi-arrow-repeat fs-2"></i>
      </button>

      <button class="btn btn-lg btn-link"
        :class="{ 'text-success': state.isAllowSpeedOverride, 'text-secondary': !state.isAllowSpeedOverride }"
        @click="state.isAllowSpeedOverride = !state.isAllowSpeedOverride" type="button" id="speedOverrideToggle"
        title="Toggle Speed Override" style="font-size: 2.8rem; min-width: 64px; min-height: 64px;">
        <i :class="state.isAllowSpeedOverride ? 'bi bi-toggle-on' : 'bi bi-toggle-off'"></i>
      </button>

      <div class="d-flex align-items-center my-2">
        <button class="btn btn-lg" @click="zoomLevel = Math.max(0.8, zoomLevel - 0.1)">-</button>
        <span class="mx-2">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="btn btn-lg" @click="zoomLevel = Math.min(2.0, zoomLevel + 0.1)">+</button>
      </div>

    </div>
    <div class="flex-fill d-flex flex-column h-100 p-2">
    

      <div class="d-flex flex-row gap-2" style="min-height:100px; align-items: flex-start;">
        <div class="d-flex flex-column rounded border" style="min-width: 200px; padding: 0.5rem;"
          :class="{ 'border-primary': item === state.selectedLoco, 'border-secondary': item !== state.selectedLoco }"
          :style="{ 'background-color': hexToRgba(item.color, 0.1) }" v-for="item in state.roster" :key="item.id">
          
          <!-- Header with name and delete button -->
          <div class="d-flex gap-2 align-items-center mb-2">
            <button class="btn btn-outline-primary btn-sm flex-grow-1" @click="showLocoControllerPopup(item, $event)">
               <i v-show="item.warning" @click.prevent="item.resetWarning()" class="bi bi-exclamation-triangle"></i>
              {{ item.label }}
              <i v-if="item.route.path" class="bi bi-signpost"></i>
              <i v-if="!item.hasPosition()" class="bi bi-question"></i>
            </button>
            <a href="#" class="btn btn-sm btn-outline-danger" @click.prevent="deleteLoco(item)" title="Remove loco">
              <i class="bi bi-trash"></i>
            </a>
          </div>

          <!-- Speed controls -->
          <div class="d-flex flex-row justify-content-center align-items-center gap-2">
            <a href="#" class="text-decoration-underline"
              @click.prevent="updateSpeedDirection(item, undefined, item.direction === 1 ? 0 : 1)" title="Toggle direction">
              <i v-if="item.direction === 1" class="bi bi-arrow-up"></i>
              <i v-if="item.direction === 0" class="bi bi-arrow-down"></i>
            </a>
            <span class="fs-4" style="min-width: 50px; text-align: center;">{{ item.adjustedSpeed || 0 }}<sup style="font-size: 0.5em;">/{{ item.speed || 0 }}</sup></span>
            <a :enabled="item.speed>0" href="#" class="text-danger text-decoration-underline" @click.prevent="stopLoco(item)" title="Stop">
              <i class="bi bi-sign-stop"></i>
            </a>
          </div>
          
          <!-- Position info -->
          <div v-if="item.trainPosition?.startBlockId" style="font-size: 0.7rem;" class="text-secondary">
            <div class="text-center">
              <strong>B: {{ item.trainPosition.startBlockId }}</strong>
              <template v-if="item.getNextBlock()">
                → {{ item.getNextBlock() }}
              </template>
            </div>
            <div v-if="item.deadReckoningAdjustments.length > 0" class="text-center mt-1">
              <span class="badge bg-warning text-dark" style="font-size: 0.65rem;" title="Dead reckoning adjustments">
                🔄 {{ item.deadReckoningAdjustments.length }}
              </span>
            </div>
          </div>
          <div v-else style="font-size: 0.7rem;" class="text-secondary text-center">
            <em>No position</em>
          </div>

        </div>
      </div>

      
      <div class="flex-fill d-flex flex-column position-relative">
        <!-- View selector buttons -->
        <div class="d-flex gap-2 border-bottom pb-1 pt-1 px-2 bg-light" style="align-items: center; height: auto;">
          <button class="btn btn-sm" :class="view === 'map' ? 'btn-primary' : 'btn-outline-secondary'" @click="view = 'map'">Map</button>
          <button class="btn btn-sm" :class="view === 'log' ? 'btn-primary' : 'btn-outline-secondary'" @click="view = 'log'">Log</button>
          <button class="btn btn-sm" :class="view === 'calibration' ? 'btn-primary' : 'btn-outline-secondary'" @click="view = 'calibration'">Calibration</button>
          <a v-if="view === 'log'" href="#" class="text-decoration-underline small ms-auto"
            @click.prevent="state.logEntries = []">Clear</a>
          <a v-if="view === 'calibration'" href="#" class="text-decoration-underline small ms-auto"
            @click.prevent="showClearCalibrationConfirm = true">Clear All</a>
        </div>

        <!-- Map view -->
        <div v-if="view === 'map'" class="svg-container flex-fill" ref="svgContainer" v-html="layoutPlan"></div>

        <!-- Log view -->
        <div v-if="view === 'log'" class="flex-fill d-flex flex-column">
          <div class="d-flex gap-2 align-items-center px-2 py-1 border-bottom" style="height: auto;">
            <span class="small text-secondary">Filter:</span>
            <select v-model="logSourceFilter" class="form-select form-select-sm" style="max-width: 150px;">
              <option value="">All Sources</option>
              <option value="loco">Locos</option>
              <option value="layout">Layout</option>
              <option value="serial">Serial</option>
            </select>
          </div>
          <div class="flex-fill" style="overflow-y: auto; scrollbar-width: thick;" ref="logContainer">
            <table class="table table-sm table-striped mb-0" style="font-size: 0.8rem;">
              <thead class="table-light sticky-top">
                <tr>
                  <th style="width: 60px; padding: 0.25rem 0.5rem;">Time</th>
                  <th style="width: 60px; padding: 0.25rem 0.5rem;">Source</th>
                  <th style="padding: 0.25rem 0.5rem;">Event</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in filteredLogEntries" :key="entry.timestamp" style="height: auto;">
                  <td style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">{{ entry.timestamp }}</td>
                  <td style="padding: 0.25rem 0.5rem;"><small><span class="badge" :class="getSourceBadgeClass(entry.source)" style="font-size: 0.65rem;">{{ entry.source }}</span></small></td>
                  <td style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">{{ entry.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Calibration view -->
        <div v-if="view === 'calibration'" class="flex-fill d-flex flex-column">
          <div class="flex-fill" style="overflow-y: auto; scrollbar-width: thick; padding: 0.5rem;">
            <div style="font-size: 0.75rem;">
            
            <!-- Dead Reckoning Adjustments -->
            <div v-if="Object.values(state.roster).some(l => l.deadReckoningAdjustments.length > 0)" class="mb-2">
              <h6 class="mb-1" style="font-size: 0.85rem;">Dead Reckoning Adjustments</h6>
              <div v-for="loco in state.roster" :key="loco.id" class="mb-1">
                <div v-if="loco.deadReckoningAdjustments.length > 0" class="p-1 border border-warning rounded" style="background-color: #fff8e1;">
                  <small class="text-warning" style="font-size: 0.7rem;"><strong>{{ loco.label }}</strong> <span class="badge bg-warning text-dark px-1" style="font-size: 0.6rem;">{{ loco.deadReckoningAdjustments.length }}</span></small>
                  <table class="table table-sm table-striped mt-0 mb-0" style="font-size: 0.65rem;">
                    <tbody>
                      <tr v-for="(adj, idx) in loco.deadReckoningAdjustments.slice(-3)" :key="idx" style="height: auto;">
                        <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ adj.blockId }}</td>
                        <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ Math.round(adj.oldOffset) }}→{{ Math.round(adj.newOffset) }}</td>
                        <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ adj.timeSinceLastEntry?.toFixed(1) }}s</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Cross-Loco Calibration Comparison -->
            <div v-if="calibrationComparison && Object.keys(calibrationComparison.blockAnalysis || {}).length > 0">
              <h6 class="mb-1" style="font-size: 0.85rem;">Calibration</h6>
              <div v-for="(analysis, blockId) in calibrationComparison.blockAnalysis" :key="blockId" class="mb-1 p-1 border rounded" style="background-color: #f8f9fa;">
                <div class="small mb-0" style="font-size: 0.7rem;"><strong>Block {{ blockId }}</strong> <span class="badge bg-secondary px-1" style="font-size: 0.6rem;">{{ analysis.trackLength }}px</span></div>
                <div style="font-size: 0.65rem; margin-top: 2px;">Avg: {{ analysis.groupAverage }}px | Locos: {{ analysis.locoCount }} | {{ analysis.groupConsistency }}%</div>
                <table class="table table-sm mt-1 mb-0" style="font-size: 0.6rem;">
                  <thead>
                    <tr style="height: auto;">
                      <th class="p-1" style="padding: 0.25rem 0.5rem !important;">Loco</th>
                      <th class="p-1" style="padding: 0.25rem 0.5rem !important;">Measured</th>
                      <th class="p-1" style="padding: 0.25rem 0.5rem !important;">Cons %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in analysis.measurements" :key="m.locoLabel" class="p-0" style="height: auto;">
                      <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ m.locoLabel }}</td>
                      <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ m.avgMeasured }}</td>
                      <td class="p-1" style="padding: 0.25rem 0.5rem !important;">{{ m.consistency }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="text-muted small">No calibration data yet. Run trains to collect measurements.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
    <div v-if="state.matchLocoModal.show && state.matchLocoModal.pins?.length" class="modal fade show d-block"
      tabindex="-1" >
      <div class="modal-dialog" style="max-width: 900px;">
        <div class="modal-content">
          <div class="modal-header">
            <strong class="modal-title">
              Assign a Loco to Block {{ state.matchLocoModal.pins[0] }}
              <span v-if="state.matchLocoModal.pins.length > 1" class="badge bg-secondary ms-2">
                {{ state.matchLocoModal.pins.length }} unresolved
              </span>
            </strong>
            <button type="button" class="btn-close"
              @click="state.matchLocoModal.show = false; state.matchLocoModal.pins = []"></button>
          </div>
          <div class="modal-body">
            <div style="display: grid !important; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
              <button v-for="loco in state.roster.filter(l => !l.hasPosition())" 
                :key="loco.id"
                class="btn btn-sm btn-primary"
                @click="
                  onLocationEntered(loco, [state.matchLocoModal.pins[0]]);
                  state.matchLocoModal.pins.shift();
                  if (state.matchLocoModal.pins.length === 0) state.matchLocoModal.show = false;
                  else highlightBlock(state.matchLocoModal.pins[0]);
                ">
                {{ loco.label }}
              </button>
            </div>
            <button class="btn btn-sm btn-secondary w-100"
              @click="state.matchLocoModal.show = false; state.matchLocoModal.pins = []; highlightBlock(null)">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="state.locoControllerPopup.show" ref="locoControllerPopup"
      class="position-absolute bg-white border rounded shadow p-3" :style="{
        top: state.locoControllerPopup.position.top + 'px',
        left: state.locoControllerPopup.position.left + 'px',
        zIndex: 1050,

        width: '200px',
      }">
      <!-- Controller content, reuse your existing controller markup -->
      <div>
        <div class="fw-bold mb-1">{{ state.locoControllerPopup.loco.label }}</div>

        <!-- Tab Navigation -->
        <ul class="nav nav-tabs flex-nowrap" id="myTab" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link px-1 active" id="tab1-tab" data-bs-toggle="tab" data-bs-target="#tab1" type="button"
              role="tab" aria-controls="tab1" aria-selected="true">Control</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link px-1" id="tab2-tab" data-bs-toggle="tab" data-bs-target="#tab2" type="button"
              role="tab" aria-controls="tab2" aria-selected="false">Route</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link px-1" id="tab3-tab" data-bs-toggle="tab" data-bs-target="#tab3" type="button"
              role="tab" aria-controls="tab3" aria-selected="false">Debug</button>
          </li>
        </ul>

        <!-- Tab Content -->
        <div class="tab-content mt-3 h-100" id="myTabContent">

          <div class="tab-pane fade show active" id="tab1" role="tabpanel" aria-labelledby="tab1-tab">
            <div class="btn-group m-2" role="group" aria-label="Basic radio toggle button group" style="flex-basis: 66%;">
              <input type="radio" class="btn-check" name="btnradio" id="btnradio1" autocomplete="off"
                v-model="state.selectedLoco.direction" :value="0" :disabled="!state.selectedLoco"
                @change="updateSpeedDirection(state.selectedLoco)">
              <label class="btn btn-outline-primary p-1 px-2 fs-5" for="btnradio1">&lt;</label>

              <input type="radio" class="btn-check" name="btnradio" id="btnradio2" autocomplete="off"
                v-model="state.selectedLoco.direction" :value="1" :disabled="!state.selectedLoco"
                @change="updateSpeedDirection(state.selectedLoco)">
              <label class="btn btn-outline-primary p-1 px-2 fs-5" for="btnradio2">&gt;</label>
            </div>
            <div class="">
              <input type="range" min="0" max="125" v-model="state.selectedLoco.speed" id="simpleRange"
                :disabled="!state.selectedLoco" @change="updateSpeedDirection(state.selectedLoco)"
                style="width: 64px; height: 260px;" />

              <div class="value-display fs-3" id="rangeValue">{{ state.selectedLoco.speed }}</div>
            </div>
            <button class="btn btn-outline-danger p-1 px-2" @click="stopLoco(state.selectedLoco)" style="flex-basis: 66%;">Stop</button>


          </div>
          <div class="tab-pane fade" id="tab2" role="tabpanel" aria-labelledby="tab2-tab">
            <div class="d-flex gap-1" style="flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline-secondary flex-grow-1" style="max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" @click="setLocoRouteStart(state.selectedLoco)" :title="locoRouteStartDesc">{{
                locoRouteStartDesc }}</button>
              <button class="btn btn-sm btn-outline-secondary flex-grow-1" style="max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" @click="setLocoRouteEnd(state.selectedLoco)" :title="locoRouteEndDesc">{{
                locoRouteEndDesc }}</button>
              <button class="btn btn-sm btn-outline-secondary" :enabled="hasRoute"
                @click="reverseRoute(state.selectedLoco)">Reverse</button>
              <button class="btn btn-sm btn-outline-secondary" :enabled="hasRoute"
                @click="clearRoute(state.selectedLoco)">Clear</button>
            </div>
            <div class="d-flex gap-1" style="flex-wrap: wrap;">
              <button class="btn btn-sm btn-outline-secondary" @click="startRoute(state.selectedLoco)">Start</button>
              <button class="btn btn-sm btn-outline-secondary" @click="simulateNext()">Sim next</button>

              <button class="btn btn-sm btn-outline-secondary" @click="setPointsForRoute(state.selectedLoco)">Set
                points</button>
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
              <input type="text" class="form-control form-control-sm" placeholder="Location"
                v-model="enteredLocoLocations" @keydown.enter="onLocationEntered(state.selectedLoco)" />
              {{ selectedLocoLocations }}
            </div>
            <div class="d-flex flex-row fs-sm">
              <input type="text" class="form-control form-control-sm" placeholder="Location"
                v-model="state.simulatedPin" />
              <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 1)">Hi</button>
              <button class="btn btn-sm " @click="onPinChanged(state.simulatedPin, 0)">Lo</button>
            </div>

            <pre class="d-flex flex-row fs-xs">{{ selectedLocoPosition }}</pre>
            <div v-if="state.selectedLoco.blockHistory" class="table-responsive small"
              style="max-height: 300px; overflow-y: auto;">
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

              <button class="btn btn-sm btn-primary" @click="state.selectedLoco.clearBlockHistory()">Clear</button>

            </div>
          </div>
        </div>



        <!--<button class="btn btn-sm btn-outline-danger" @click="hideLocoControllerPopup()">Close</button>-->
      </div>
    </div>

    <!-- Clear Calibration Confirmation Modal -->
    <div v-if="showClearCalibrationConfirm" class="modal fade show d-block" tabindex="-1">
      <div class="modal-dialog modal-sm">
        <div class="modal-content">
          <div class="modal-header">
            <strong class="modal-title">Clear Calibration Data</strong>
            <button type="button" class="btn-close" @click="showClearCalibrationConfirm = false"></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to clear all calibration data for all locos?</p>
            <p class="text-muted small">This cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showClearCalibrationConfirm = false">Cancel</button>
            <button type="button" class="btn btn-danger" @click="clearAllCalibration()">Clear</button>
          </div>
        </div>
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
      layout: Layout,
      state: reactive({
        connectionInfo: "Not connected",
        isConnected: false,
        serialOutput: "",
        logEntries: [],
        selectedLoco: null,
        roster: [],
        blockLookup: {},
        pointLookup: {},
        isAllowSpeedOverride: false,
        matchLocoModal: {
          show: false,
          pins: []
        },
        locoControllerPopup: {
          show: false,
          loco: null,
          position: { top: 0, left: 0 }
        },
      }),
      zoomLevel: 1,
      layoutPlan: layoutPlan,
      routeView: false,
      routeStep: 0,
      view: 'map',
      animationFrameId: null,
      enteredLocoLocations: "", // plain text user types
      previousHighlightedBlock: null,
      calibrationComparison: null,
      locoDeadReckoningAdjustments: {}, // Track locos being pulled back
      logSourceFilter: '', // Filter logs by source
      showClearCalibrationConfirm: false // Show clear calibration confirmation
    };
  },
  computed: {
    filteredLogEntries() {
      if (!this.logSourceFilter) {
        return this.state.logEntries;
      }
      return this.state.logEntries.filter(entry => entry.source === this.logSourceFilter);
    }
  },
  methods: {
    getSourceBadgeClass(source) {
      const classes = {
        'loco': 'bg-primary',
        'layout': 'bg-success',
        'serial': 'bg-info'
      };
      return classes[source] || 'bg-secondary';
    },
    updateCalibrationView() {
      this.calibrationComparison = this.layout.compareLocoCalibrations();
    },
    clearAllCalibration() {
      // Clear calibration data for all locos
      this.state.roster.forEach(loco => {
        loco.blockCalibration = {};
        loco.deadReckoningAdjustments = [];
      });
      
      // Clear stored calibration from localStorage
      localStorage.removeItem('locoCalibrationStats');
      
      // Update views
      this.updateCalibrationView();
      this.layout.addLogEntry("layout", "✓ All calibration data cleared");
      
      // Close confirmation modal
      this.showClearCalibrationConfirm = false;
    },
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
      if (!loco) return; ``
      blockIds = blockIds || this.enteredLocoLocations.split(',');
      blockIds.forEach(blockId => {
        if (blockId.trim()) {
          loco.blockLocationChanged(blockId.trim(), 1);
        }
      });
      // Save state after location change
      this.saveLocoState();
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
    deleteLoco(loco) {
      // Remove from roster
      const index = this.state.roster.findIndex(l => l.id === loco.id);
      if (index > -1) {
        this.state.roster.splice(index, 1);
        // Clear selection if it was selected
        if (this.state.selectedLoco?.id === loco.id) {
          this.state.selectedLoco = null;
        }
        // Save updated roster
        this.saveLocoState();
        console.log(`Deleted loco ${loco.label}`);
      }
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
      let me = this;
      me.selectedBlock && loco.setRouteStart(me.selectedBlock.id);

    },
    setLocoRouteEnd(loco) {
      let me = this;
      me.selectedBlock && loco.setRouteEnd(me.selectedBlock.id);
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
              marker.setAttribute("r", "4");
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
      let me = this;

      for (const [pointId, element] of Object.entries(me.elementLookup.points)) {
        const point = me.state.pointLookup[pointId];
        if (!point) {
          console.log(`Point info not found: ${pointId}`);
          continue;
        }
        element.style.fill = (point.state === 1 ? 'blue' : 'red');
      }
    },
    processSvgElements() {
      let me = this;

      for (const [pointId, element] of Object.entries(me.elementLookup.points)) {
        const point = me.state.pointLookup[pointId];
        if (!point) {
          console.log(`Point info not found: ${pointId}`);
          continue;
        }
        SvgUtils.configPointEllipse(element, () => {
          me.layout.setPointState(point, point.state === 0 ? 1 : 0);
          console.log(`Clicked on ${point.vpin} - ${point.desc}: ${point.state}`)
          me.refreshSvgElementStyles();

        });
      }

      for (const [blockId, element] of Object.entries(me.elementLookup.blocks)) {
        const block = me.state.blockLookup[blockId];
        if (!block) {
          console.log(`block info not found: ${blockId}`);
          continue;
        }
        me.configureBlockPath(element, block);
      }
    },
    configureBlockPath(path, block) {
      let me = this;
      SvgUtils.addPathLabel(path, block.id);
      SvgUtils.addPathClickTarget(path, function (event) {

        if (block) {
          me.selectedBlock = block;
          if (me.routeView && me.state.selectedLoco) {
            const loco = me.state.selectedLoco;
            if (loco.hasPosition()) {
              loco.setRouteStart(loco.getStartBlockId());
              loco.setRouteEnd(me.selectedBlock.id);
              return;
            }


            if (me.routeStep === 0) {
              loco.setRouteStart(me.selectedBlock.id);
              me.routeStep = 1;
            } else {
              loco.setRouteEnd(me.selectedBlock.id);
              me.routeStep = 0;
            }
          } else {
            me.onPinChanged(block.id, block.value === 0 ? 1 : 0);
          }
        }
      });

    },

    resetBlockFormats() {
      let me = this;
      for (const [blockId, element] of Object.entries(me.elementLookup.blocks)) {
        //const block=me.state.blockLookup[blockId];
        //const isOccupied=me.state.roster.reduce((a,d)=>a || d.isOccupyingBlock(blockId), false);
        const loco = me.layout.isBlockOccupied(blockId);

        SvgUtils.setLineStoke(element, loco ? 4 : 4, loco ? (loco.color || "grey") : "green");
      }
    },
    refreshBlocks() {
      const LOCO_ROUTE_CLASS = "loco-route";
      let me = this;
      me.resetBlockFormats();
      SvgUtils.removeSvgElementsByClass(LOCO_ROUTE_CLASS);

      const blockWithRoute = me.layout.getBlocksWithRoute();
      for (const [blockId, locos] of Object.entries(blockWithRoute)) {
        const element = me.elementLookup.blocks[blockId];
        if (!element) continue;
        locos.forEach((loco, i) => {
          if (loco !== me.state.selectedLoco) return;
          SvgUtils.addBackgroundStroke(element, loco.color, 8, LOCO_ROUTE_CLASS);

        });
      }

    },
    highlightBlock(blockId) {
      // Clear previous highlight
      if (this.previousHighlightedBlock) {
        this.previousHighlightedBlock.style.stroke = 'green';
        this.previousHighlightedBlock.style.strokeWidth = '4';
        this.previousHighlightedBlock.style.filter = 'none';
        this.previousHighlightedBlock = null;
      }
      
      // Highlight new block
      if (blockId && this.elementLookup?.blocks) {
        const blockElement = this.elementLookup.blocks[blockId];
        if (blockElement) {
          this.previousHighlightedBlock = blockElement;
          blockElement.style.stroke = 'orange';
          blockElement.style.strokeWidth = '8';
          blockElement.style.filter = 'drop-shadow(0 0 5px orange)';
        }
      }
    },
    saveLocoState() {
      // Save loco positions and roster to localStorage
      const locoStates = this.layout.state.roster.map(loco => ({
        id: loco.id,
        blockId: loco.trainPosition?.startBlockId,
        offset: loco.trainPosition?.startOffset,
        speed: loco.speed,
        direction: loco.direction
      }));
      localStorage.setItem('locoStates', JSON.stringify(locoStates));
      
      // Also save full roster info for next startup
      const rosterData = this.layout.state.roster.map(loco => ({
        id: loco.id,
        label: loco.label,
        address: loco.address,
        speed: loco.speed,
        direction: loco.direction,
        route: loco.route
      }));
      localStorage.setItem('locoRoster', JSON.stringify(rosterData));
      
      // Save calibration stats
      this.layout.saveLocoCalibrationStats();
    },
    loadLocoState() {
      // Load loco positions from localStorage
      try {
        const saved = localStorage.getItem('locoStates');
        if (!saved) return;
        
        const locoStates = JSON.parse(saved);
        
        locoStates.forEach(savedState => {
          const loco = this.layout.state.roster.find(l => l.id === savedState.id);
          if (loco && savedState.blockId) {
            // Check if block is already occupied (from Electron pin data)
            const blockOccupant = this.layout.isBlockOccupied(savedState.blockId);
            if (!blockOccupant) {
              // Block is free, restore saved position
              loco.blockLocationChanged(savedState.blockId, 1);
              if (savedState.speed !== undefined) loco.speed = savedState.speed;
              if (savedState.direction !== undefined) loco.direction = savedState.direction;
            }
          }
        });
      } catch (error) {
        console.error('Error loading loco state:', error);
      }
    },

  },
  computed: {
    hasRoute() {
      const loco = this.state.selectedLoco;
      return loco && loco.route.path;
    },
    locoRouteStartDesc() {
      const loco = this.state.selectedLoco;
      if (!loco || !loco.route.start) return "-";
      return loco.route.start;
    },
    locoRouteEndDesc() {
      const loco = this.state.selectedLoco;
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
        // Update calibration if viewing that tab
        if (this.view === 'calibration') {
          this.updateCalibrationView();
        }
      }
    },
    'state.logEntries': {
      deep: true,
      handler() {
        // Auto-scroll log to bottom on new entries
        this.$nextTick(() => {
          const container = this.$refs.logContainer;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    },
    view(newView) {
      if (newView === 'calibration') {
        this.updateCalibrationView();
      } else if (newView === 'map') {
        // Re-process SVG when switching back to map view
        // The SVG container is recreated due to v-if, so we need to reattach handlers
        this.$nextTick(() => {
          const svg = this.$refs.svgContainer?.querySelector('svg');
          if (svg && this.layout) {
            this.elementLookup = this.layout.processLayoutSvg(svg);
            this.processSvgElements();
          }
        });
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
    'state.matchLocoModal': {
      deep: true,
      handler(matchLocoModal) {
        console.log("matchLocoModal changed:", matchLocoModal);
        if (matchLocoModal.show && matchLocoModal.pins && matchLocoModal.pins.length > 0) {
          this.highlightBlock(matchLocoModal.pins[0]);
        } else {
          this.highlightBlock(null);
        }
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

    let me = this;
    const svg = me.$refs.svgContainer?.querySelector('svg');
    me.layout = new Layout(me.state);
    me.layout.init();


    me.elementLookup = me.layout.processLayoutSvg(svg);
    me.processSvgElements();

    me.startAnimationLoop();
    
    // Load saved loco positions after layout is initialized
    setTimeout(() => {
      me.loadLocoState();
    }, 100);

    // Update calibration view every 5 seconds when viewing calibration
    setInterval(() => {
      if (this.view === 'calibration') {
        this.updateCalibrationView();
      }
    }, 5000);
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
table.table-sm td,
table.table-sm th {
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

.h-10 {
  height: 10%;
}

/* Custom scrollbar styling for better touch interface */
:deep(::-webkit-scrollbar) {
  width: 16px;
}

:deep(::-webkit-scrollbar-track) {
  background: #f1f1f1;
}

:deep(::-webkit-scrollbar-thumb) {
  background: #888;
  border-radius: 10px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background: #555;
}
.h-20 {
  height: 20%;
}

.h-30 {
  height: 30%;
}

.h-60 {
  height: 60%;
}

.h-70 {
  height: 70%;
}

.h-80 {
  height: 80%;
}


input[type="range"] {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 20px;
  /* Width of the slider */

  background: #ddd;
  border-radius: 8px;

}

input[type="range"]::-moz-range-track {
  height: 20px;
  /* Thicker track for Firefox */
  background: #ddd;
  border-radius: 8px;
}

input[type="range"]::-ms-fill-lower,
input[type="range"]::-ms-fill-upper {
  height: 20px;
  /* Thicker track for IE/Edge */
  background: #ddd;
  border-radius: 8px;
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

</style>
