// Loco.js
class Loco {
    constructor(data, layout) {
        Object.assign(this, data);
        this.layout = layout; // Reference to Layout instance
        this._debounceTimers = {}; // For block debounce
        this._lastBlockId = null;

        this.trainPosition = {
            startBlockId: null,
            startOffset: 0, // pixels
            occupiedBlocks: [], // List of fully occupied block IDs
            endBlockId: null,
            endOffset: 0
        };

        this.length = 100; // pixels for now
        this.numCarriages = 5;
        this.adjustedSpeed = 0; 
        this.lastLocoSpeed = 0; // last speed sent to DCC
        this.lastUpdateTime = Date.now(); // timestamp in ms
        this.blockHistory = []; // [{blockId: "B12", time: 1680000000000}]
    }

    stop() {
        this.speed = 0;
        this.adjustedSpeed = 0;
        this.updateSpeedDirection();
    }

    getAdjustedSpeed(offset, blockLength) {

       
        const blockLookup = this.layout.state.blockLookup;
        const pointLookup = this.layout.state.pointLookup;
        const currentBlockId = this.trainPosition.startBlockId;
        const currentBlock = blockLookup[currentBlockId];
        if (!currentBlock) return { adjustedSpeed: 0, reason: 'Invalid current block' };
    
        let baseLimit = 5;
        
        const blockLengthRemaining = this.direction === 1
                ? blockLength - offset
                : offset;

        // Check if diverging point is involved
        const dirKey = this.direction === 1 ? 'forward' : 'backward';
        const pointId = currentBlock[dirKey]?.pointId;
        let nextBlockId = this.direction === 1
            ? this.layout.getActiveForwardConnection(currentBlock)
            : this.layout.getActiveBackwardConnection(currentBlock);
        
        


        if (blockLengthRemaining<75 && !this.layout.state.isAllowSpeedOverride) {
            if (!nextBlockId) {
                return { adjustedSpeed: 0, reason: 'No next block (end of track)' };
            }
            let occupied = this.layout.isBlockOccupied(nextBlockId);
            if (occupied) {
                return { adjustedSpeed: 0, reason: `Next block occupied by ${occupied.label}` };
            }

            const nextBlock = blockLookup[nextBlockId];
            const nextBlockPointId = this.direction === 1
                ? nextBlock?.backward.pointId
                : nextBlock?.forward.pointId;
        
            if (pointId != null) {
                const point = pointLookup[pointId];
                const state = point?.state ?? 0;
               
                if (state === 0) {
                    baseLimit = Math.min(baseLimit, 1);
                }
            }
            
            if (nextBlockPointId != null) {
                const point = pointLookup[nextBlockPointId];
                const state = point?.state ?? 0;
                

                const connectionIndex = this.direction === 1 
                    ? nextBlock.backward.connections.indexOf(currentBlockId)
                    : nextBlock.forward.connections.indexOf(currentBlockId);

                if (connectionIndex === -1) {
                    // Defensive: not even in the list
                    return { adjustedSpeed: 0, reason: `Next block ${nextBlockId} not reachable from ${currentBlock.id}` };
                }

                if ((state===0 && connectionIndex!==1) || (state===1 && connectionIndex!==0)) {
                    // Check if the turnout is aligned for the next block
                    // If not, we need to check if the next block is a valid connection
                    return {
                        adjustedSpeed: 0,
                        reason: `Turnout ${pointId} misaligned: would derail toward block ${nextBlockId}`
                    };
                }
                // Check if the turnout is aligned for the next block
                // Diverging = apply speed limit 1
                if (state === 0) {
                    baseLimit = Math.min(baseLimit, 1);
                }
            }
        }

        if (baseLimit > 1) {
            const blocks = this.getOccupiedBlockIds();
            if (!blocks.length) {
                return { adjustedSpeed: 0, reason: "No occupied blocks" };
            }

            for (let i = 0 ; i < blocks.length && baseLimit > 1; i++) {
                const blockId = blocks[i];
                const block = blockLookup[blockId];
                if (!block) continue; // Skip if block not found

               
                if (i < blocks.length - 1) {
                    const nextBlockId = blocks[i + 1];
                    const nextBlock = blockLookup[nextBlockId];

                    const thisConnectionIndex = this.direction === 1 
                        ? block.backward.connections.indexOf(nextBlockId)
                        : block.forward.connections.indexOf(nextBlockId);

                    const nextConnectionIndex = this.direction === 1 
                        ? nextBlock.backward.connections.indexOf(currentBlockId)
                        : nextBlock.forward.connections.indexOf(currentBlockId);

                    if (thisConnectionIndex > 0 || nextConnectionIndex > 0) {
                        // Check if the turnout is aligned for the next block
                        // Diverging = apply speed limit 1
                        baseLimit = 1;
                    }   
                    

                }   

            }

            if (baseLimit > 1) {
                const minBlockSpeed = blocks.reduce((minSpeed, blockId) => {
                    const block = blockLookup[blockId];
                    if (!block) return minSpeed;
                    const speedlimit = block.speedlimit || 5; // Default to 5 if not set
                    return Math.min(minSpeed, speedlimit);
                }, Infinity);

                baseLimit = Math.min(baseLimit, minBlockSpeed);
            }

        }



        const maxAllowedSpeed = 125 * (baseLimit / 5);
        const actualSpeed = Math.min(this.speed, maxAllowedSpeed);
    
        return { adjustedSpeed: actualSpeed, reason: null };
    }

    updateSpeedDirection() {

        if (!this.layout.state.isConnected) return;

        const speed = this.adjustedSpeed ;
        if (speed === this.lastLocoSpeed) return;

        this.lastLocoSpeed = speed;
        window.electronAPI.setCabSpeed(this.id, speed, this.direction)
            .then(response => {
                this.layout.addSerialOutput(`Cab Speed Response: ${response}`);
            });
    }

    getSpeedInPixelsPerSecond(speed) {
        // Replace with real calibration or mapping later
        const maxDccSpeed = 127;
        const maxPixelsPerSecond = 100; // e.g., full throttle = 100px/s
        return (speed / maxDccSpeed) * maxPixelsPerSecond;
    }

    updateTrainPosition() {
        const now = Date.now();
        const elapsedSeconds = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;

       
        const blockLookup = this.layout.state.blockLookup;
        const block = blockLookup[this.trainPosition.startBlockId];

        if (!this.speed) return;

        if (!block && !this.layout.state.isAllowSpeedOverride) {
            this.layout.addLogEntry("loco", `Train ${this.label} has no block.`);
            this.stop(); // Stop if no block found
            return;
        }

        if (!block) {
            // If no block, we can still move if speed override is allowed
            if (this.layout.state.isAllowSpeedOverride) {
                this.adjustedSpeed = this.speed;
                this.updateSpeedDirection();
                return;
            }
 
        }
        

        const blockLength = block.length || 10;
        const offset = this.trainPosition.startOffset;

        const { adjustedSpeed, reason } = this.getAdjustedSpeed(offset, blockLength);

        if (adjustedSpeed === 0 && this.speed > 0) {
           
            //why did we change the offset in this cas?
            /*
            const margin = 100; // pixels before point/edge
            this.trainPosition.startOffset = this.direction === 1
                ? Math.min(offset, blockLength - margin)
                : Math.max(offset, margin);
            */
            this.stop(); // sets this.speed = 0 and sends DCC
            this.layout.addLogEntry("loco", `Loco ${this.label} stopped due to: ${reason}`);
            //this.layout.broadcastLocoException?.(this, reason);
            return;
        }

        const distanceToMove = this.getSpeedInPixelsPerSecond(adjustedSpeed) * elapsedSeconds;
        this.adjustedSpeed = adjustedSpeed; // Store adjusted speed for later use
        this.updateSpeedDirection(); // Send DCC command
        if (this.direction === 1) { // forward
            this.trainPosition.startOffset += distanceToMove;

            if (this.trainPosition.startOffset >= blockLength) {
                // Reached end of block
                const nextBlockId = this.layout.getActiveForwardConnection(block)
                if (nextBlockId) {
                    this.trainPosition.startBlockId = nextBlockId;
                    this.trainPosition.startOffset = 0;
                } else {
                    // No next block
                    this.trainPosition.startOffset = blockLength;
                    this.speed = 0;
                    this.layout.addLogEntry("loco", `Train ${this.label} reached end of track.`);
                }
            }

        } else { // backward
            this.trainPosition.startOffset -= distanceToMove;

            if (this.trainPosition.startOffset <= 0) {
                // Reached start of block
                const prevBlockId = this.layout.getActiveBackwardConnection(block);

                if (prevBlockId) {
                    this.trainPosition.startBlockId = prevBlockId;
                    const prevBlock = blockLookup[prevBlockId];
                    this.trainPosition.startOffset = prevBlock ? (prevBlock.length || 10) : 0;
                } else {
                    // No previous block
                    this.trainPosition.startOffset = 0;
                    this.speed = 0;
                    this.layout.addLogEntry("loco", `Train ${this.label} reached start of track.`);
                }
            }
        }

        this.updateTrainPositionFromHead(); // Update end position based on head position
    }

    updateTrainPositionFromHead() {
        const blockLookup = this.layout.state.blockLookup;
        let remainingLength = this.length;
    
        let currentBlockId = this.trainPosition.startBlockId;
        let currentOffset = this.trainPosition.startOffset;
    
        const occupied = [];
    
        // ✅ Determine traversal direction: tail goes opposite of travel
        const walkDirection = this.direction === 1 ? 'backward' : 'forward';
        const getNextBlock = (block) =>
            walkDirection === 'forward'
                ? this.layout.getActiveForwardConnection(block)
                : this.layout.getActiveBackwardConnection(block);
    
        let firstBlock = true;
    
        while (remainingLength > 0 && currentBlockId) {
            const block = blockLookup[currentBlockId];
            if (!block) break;
    
            const blockLength = block.length || 10;
            let usableLength;
    
            if (walkDirection === 'backward') {
                usableLength = currentOffset; // how much we can use from this point backward
            } else {
                usableLength = blockLength - currentOffset;
            }
    
            if (remainingLength <= usableLength) {
                // ✅ Tail ends inside this block
                this.trainPosition.endBlockId = currentBlockId;
                this.trainPosition.endOffset =
                    walkDirection === 'backward'
                        ? currentOffset - remainingLength
                        : currentOffset + remainingLength;
                break;
            } else {
                // ✅ Fully occupy this block
                if (!firstBlock) occupied.push(currentBlockId);
                remainingLength -= usableLength;
    
                const nextBlockId = getNextBlock(block);
                const nextBlock = blockLookup[nextBlockId];
    
                if (!nextBlock) break;
    
                currentBlockId = nextBlockId;
                currentOffset =
                    walkDirection === 'backward'
                        ? nextBlock.length || 10
                        : 0;
            }
    
            firstBlock = false;
        }
    
        this.trainPosition.occupiedBlocks = occupied;
    }
    

    getCarriageOffsets() {
        if (!this.trainLength || !this.numCarriages) return [];
    
        const spacing = this.trainLength / (this.numCarriages - 1);
        return Array.from({ length: this.numCarriages }, (_, i) => i * spacing);
    }

    setRouteStart(blockInfo) {
        this.route.start = blockInfo;
        if (this.route.start && this.route.end) {
            this.route.path = this.layout.findShortestPath(this.route.start, this.route.end);
        }
    }

    setRouteEnd(blockInfo) {
        this.route.end = blockInfo;
        if (this.route.start && this.route.end) {
            this.route.path = this.layout.findShortestPath(this.route.start, this.route.end);
        }
    }

    reverseRoute() {
        if (this.route.start && this.route.end) {
            const temp = this.route.end;
            this.route.end = this.route.start;
            this.route.start = temp;
            this.route.path = this.layout.findShortestPath(this.route.start, this.route.end);
        }
    }

    clearRoute() {
        this.route.start = null;
        this.route.end = null;
        this.route.path = null;
    }

    startRoute(speed = 75) {
        const path = this.route.path;
        if (!path) return;
        const firstStep = path[0];

        
        //this.locations = [firstStep.id];
        this.speed = speed;
        this.direction = firstStep.direction === "forward" ? 1 : 0;
        this.route.active = true;
        this.setPointsForRoute(1);

        //this.updateSpeedDirection();
    }

    hasActiveRoute() {
        return this.route.path && this.route.active && this.speed > 0;
    }

    getStartBlockId() {
        return this.trainPosition?.startBlockId;
    }

    getEndBlockId() {
        return this.trainPosition?.endBlockId;
    }

    getOccupiedBlockIds() {
        const pos = this.trainPosition;
        if (!pos.startBlockId) return [];
    
        const blocks = [];
    
        blocks.push(pos.startBlockId);
    
        if (Array.isArray(pos.occupiedBlocks)) {
            blocks.push(...pos.occupiedBlocks);
        }
    
        // Only add end block if it's different from start
        if (pos.endBlockId && pos.endBlockId !== pos.startBlockId) {
            blocks.push(pos.endBlockId);
        }
    
        return blocks;
    }

    hasPosition() {
        return (
            this.trainPosition.startBlockId 
         );
    }

    isOccupyingBlock(blockId) {
        return (
            this.trainPosition.startBlockId === blockId ||
            this.trainPosition.endBlockId === blockId ||
            this.trainPosition.occupiedBlocks?.includes(blockId)
        );
    }

    

    getCurrentRouteStep() {
        const path = this.route.path;
        if (!path) return -1;
        return null; //path.findIndex(step => this.locations.includes(step.id));
    }

    setPointsForRoute(maxStepsAhead = -1) {
        const currentStep = this.getCurrentRouteStep();
        if (currentStep === -1) {
            this.layout.addLogEntry("loco", `Loco ${this.label} not found on route`);
            return;
        }

        const path = this.route.path;
        let maxStep = (maxStepsAhead !== -1) ? currentStep + maxStepsAhead + 1 : path.length;
        if (maxStep > path.length) maxStep = path.length;

        for (let i = currentStep; i < maxStep; i++) {
            const step = path[i];
            if (step.type === "point") {
                const point = this.layout.state.pointLookup[step.id];
                if (point) {
                    this.layout.setPointState(point, step.direction === "straight" ? 1 : 0);
                }
            }
        }
    }

    clearBlockHistory() {
        this.blockHistory = [];
    }
    getBlockSpeedStats() {
        const stats = {};
        const speedTolerance = 0.1;
      
        this.blockHistory.forEach(entry => {
          if (
            entry.action !== 'enter' ||
            entry.exitSpeed == null ||
            entry.duration == null
          ) return;
      
          const entrySpeed = entry.entrySpeed || 0;
          const exitSpeed = entry.exitSpeed || 0;
          const speed = entry.speed || 0;
          if (Math.abs(entrySpeed - exitSpeed) > speedTolerance) {
            return; // Skip if entry and exit speeds differ
          }
      
          const block = entry.blockId;
          if (!stats[block]) {
            stats[block] = {
              blockId: block,
              visits: 0,
              totalSpeed: 0,
              minSpeed: Infinity,
              maxSpeed: -Infinity,
              totalTime: 0
            };
          }
      
          const s = stats[block];
          s.visits += 1;
          s.totalSpeed += speed;
          s.minSpeed = Math.min(s.minSpeed, speed);
          s.maxSpeed = Math.max(s.maxSpeed, speed);
          s.totalTime += entry.duration;
        });
      
        return Object.values(stats).map(s => ({
          blockId: s.blockId,
          visits: s.visits,
          avgSpeed: (s.totalSpeed / s.visits).toFixed(1),
          minSpeed: s.minSpeed.toFixed(1),
          maxSpeed: s.maxSpeed.toFixed(1),
          avgDuration: (s.totalTime / s.visits).toFixed(1),
          totalTime: s.totalTime.toFixed(1)
        }));
      }
      
    blockLocationChanged(blockId, state) {



        if (state === 1) {
            if (this._debounceTimers[blockId]) {
                clearTimeout(this._debounceTimers[blockId]);
                delete this._debounceTimers[blockId];
            }

            const now = Date.now();
             // Handle implicit exit from previous block
            const lastEntry = [...this.blockHistory].reverse().find(e => e.action === 'enter' && !e.exitTime);
            if (lastEntry && lastEntry.blockId !== blockId) {
                lastEntry.exitTime = now;
                lastEntry.duration = (now - lastEntry.time) / 1000;
                lastEntry.exitSpeed = this.adjustedSpeed ?? 0;

                const lastBlockLength = this.layout.state.blockLookup[lastEntry.blockId]?.length || 0
                lastEntry.speed = lastBlockLength / lastEntry.duration;
                /*
                this.blockHistory.push({
                    blockId: lastEntry.blockId,
                    action: 'exit',
                    time: now
                });
                */
            }

            // Only add a new entry if it's a new block
            const lastLog = this.blockHistory[this.blockHistory.length - 1];
            if (!lastLog || lastLog.blockId !== blockId || lastLog.action !== 'enter') {
                this.blockHistory.push({
                    blockId,
                    action: 'enter',
                    time: now,
                    entrySpeed:  this.adjustedSpeed ?? 0,
                    //speed: this.adjustedSpeed ?? 0
                });
            }
          
        
            // 🔥 NEW: Anchor the head position

            const blockLength = this.layout.state.blockLookup[blockId]?.length || 10;
            let offset = 0;
            if (!this.trainPosition.startBlockId) {
                offset = blockLength / 2; // Center in block if no start position
            } else if (this.direction === 1) {
                offset = 0; // Forward → enters at start
            }   else {  
                offset = blockLength; // Backward → enters at end
            }


            this.trainPosition.startBlockId = blockId;
            
            this.trainPosition.startOffset = offset;
        
            this.lastUpdateTime = Date.now();  // reset dead reckoning timer
        } else {
            if (this._debounceTimers[blockId]) {
                clearTimeout(this._debounceTimers[blockId]);
            }
    
            this._debounceTimers[blockId] = setTimeout(() => {
                const exitTime = Date.now();
    
                // Find the matching entry record
                /*
                const lastEntryIndex = [...this.blockHistory].reverse().findIndex(
                    (e) => e.blockId === blockId && e.action === "enter"
                );
                const actualIndex = lastEntryIndex !== -1 ? this.blockHistory.length - 1 - lastEntryIndex : -1;
    
                if (actualIndex >= 0) {
                    const entry = this.blockHistory[actualIndex];
                    entry.exitTime = exitTime;
                    entry.duration = (exitTime - entry.time) / 1000; // seconds
                    entry.exitSpeed = this.adjustedSpeed ?? 0;
                }
    
                this.blockHistory.push({
                    blockId,
                    action: "exit",
                    time: exitTime
                });
                */
                delete this._debounceTimers[blockId];
            }, 1000);
        }
    }
    /*
    handleBlockLocationChanged() {
        this.trainPosition.startBlockId = this.locations[0];
        this.trainPosition.startOffset = 0;
        this.lastUpdateTime = Date.now();

        if (this.locations.length > 1) return;

        const path = this.route.path;
        const currentStep = this.getCurrentRouteStep();
        if (currentStep >= path.length - 1) {
            this.stop();
            
            this.layout.addLogEntry("loco", `Loco ${this.label} reached end of route`);
            return;
        }

        const nextSegment = path[currentStep];
        if (!nextSegment) return;

        let locoSpeedChanged = false;
        if (nextSegment.direction === "forward" && this.direction !== 1) {
            this.direction = 1;
            locoSpeedChanged = true;
        } else if (nextSegment.direction === "backward" && this.direction !== 0) {
            this.direction = 0;
            locoSpeedChanged = true;
        }

        setTimeout(() => {
            this.setPointsForRoute(1);
            if (locoSpeedChanged) this.updateSpeedDirection();
        }, 2000);
    }
        */
}

export default Loco;
