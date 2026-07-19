# Loco Tracking Improvements

## Overview
Enhanced the loco position tracking system to be more reliable and self-calibrating.

## Key Improvements

### 1. **Dead Reckoning with Better Interpolation**
- **What changed**: The `updateTrainPosition()` method now properly carries over remaining offset when transitioning between blocks
- **Benefit**: Loco positions are continuously calculated based on elapsed time, speed, and segment length, providing smooth interpolation within segments
- **Implementation**: 
  - When a loco moves from one block to the next, any "overshoot" (distance beyond the block boundary) is correctly applied to the next block's starting position
  - This prevents jerky movements and positions locos more accurately mid-segment

### 2. **Segment Length Auto-Calibration**
- **What changed**: New `calibrateSegmentLength()` method measures actual transit time through segments and corrects inaccurate length values
- **Benefit**: Segment lengths become more accurate over time as locos travel through them
- **How it works**:
  - Each time a loco exits a block, the system calculates: `measuredLength = speed × durationInSegment`
  - Compares measured length to declared length; if they differ significantly (more than 5 pixels), updates the segment length
  - Uses averaging to smooth out variations and avoid over-correction

### 3. **Persistent Segment Calibration**
- **What changed**: New `saveSegmentCalibration()` and `loadSegmentCalibration()` methods in Layout.js
- **Benefit**: Corrected segment lengths are saved to localStorage and restored on app restart, improving accuracy over time
- **Implementation**:
  - Saves to `localStorage['segmentCalibration']` as a JSON map of `{blockId: length}`
  - Auto-loads calibration when SVG is processed during app initialization

### 4. **Better Block Entry Tracking**
- **What changed**: Enhanced `blockLocationChanged()` method now properly records and analyzes segment transit
- **Benefit**: System can now measure actual segment traverse times and correlate them with speed settings
- **Data collected**:
  - Entry time and speed
  - Exit time and duration
  - Measured speed from physical measurement
  - Suggests segment length corrections

### 5. **Improved Position Anchoring on Pin Changes**
- **What changed**: When pins trigger block occupancy changes, loco position is anchored at appropriate entry point
- **Benefit**: Fixes the gap between pin detection and dead reckoning; ensures consistency between sensor and calculated position
- **Logic**:
  - Forward-moving locos anchor at block start (offset=0)
  - Backward-moving locos anchor at block end (offset=blockLength)
  - First-time positioning centers in block to start

## Usage

No configuration needed! The system works automatically:

1. **As locos travel**: Block entry/exit events trigger timing measurements
2. **Measurement**: System calculates actual speed through each segment
3. **Comparison**: Compares measured length vs declared length
4. **Calibration**: If difference > threshold, updates segment length and saves to localStorage
5. **Persistence**: Corrected lengths survive app restart, gradually improving accuracy

## Technical Details

### Entry Recording
```javascript
blockHistory.push({
  blockId,
  action: 'enter',
  time: now,
  entrySpeed: this.adjustedSpeed
});
```

### Exit Measurement
- Duration = exit time - entry time
- Measured length = entrySpeed × duration
- Compared to declared length with 0.5x-2x bounds checking

### Calibration Formula
```javascript
newLength = (currentLength + measuredLength) / 2
```

### Saved State
```
localStorage['segmentCalibration'] = {
  "172": 145,
  "173": 152,
  "174": 148,
  ...
}
```

## Log Messages

The system logs calibration events:
- `"Calibrated [blockId]: XXXpx → YYYpx"` - Segment length was updated
- `"Segment calibration saved"` - Changes persisted to localStorage
- `"Segment calibration loaded"` - Restored from previous session

## Future Enhancements

1. **Speed Profile Calibration**: Track how actual speed varies vs DCC commands
2. **Segment History**: Keep statistics per segment to detect wear/changes
3. **Reset Calibration**: UI button to reset specific segments or all segments
4. **Export Calibration**: Save/load calibration data as JSON files for backup
