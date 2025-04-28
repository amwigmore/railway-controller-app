export class SvgUtils {
    static addPathLabel(path, labelText) {
        // Get the total length of the path
       const pathLength = path.getTotalLength();
 
       // Calculate the midpoint along the path (half the total length)
       const midpoint = path.getPointAtLength(pathLength / 2);
       this.addLabel(midpoint.x, midpoint.y, labelText, true)
     }
    
     static addLabel(x, y, labelText, addBackground) {
       const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
       label.style.pointerEvents = 'none';
       // Set the label's position at the midpoint coordinates
       label.setAttribute('x', x-10);
       label.setAttribute('y', y+5);
 
       // Set the text content for the label
       label.textContent = labelText;
 
       // Set some styles for the label
       label.setAttribute('font-size', '13');
       label.setAttribute('fill', 'black');
 
       // Create a background rectangle element for the label
       if (addBackground) {
         const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
 
         // Set the background rectangle attributes
         background.setAttribute('x', x - 15); // Position it slightly to the left
         background.setAttribute('y', y - 7); // Position it slightly above the label
         background.setAttribute('width', 30); // Width of the background rectangle
         background.setAttribute('height', 14); // Height of the background rectangle
         background.setAttribute('fill', 'white'); // Background color
         background.setAttribute('stroke', 'black'); // Optional border for the background
         background.style.pointerEvents = 'none';
         // Append the background rectangle and label to the SVG element
         document.querySelector('svg').appendChild(background);
 
       }
       document.querySelector('svg').appendChild(label);
     }
    
  
    static configPointEllipse(ellipse, callback) {
        let me=this;
        const cx = ellipse.getAttribute('cx');
        const cy = ellipse.getAttribute('cy');
        const rx = ellipse.getAttribute('rx');
        const ry = ellipse.getAttribute('ry');
  
        // Create transparent, larger ellipse for click area
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        hitbox.setAttribute('cx', cx);
        hitbox.setAttribute('cy', cy);
        hitbox.setAttribute('rx', parseFloat(rx) + 10); // Larger than visible ellipse
        hitbox.setAttribute('ry', parseFloat(ry) + 10);
        hitbox.setAttribute('fill', 'transparent');
        hitbox.setAttribute('stroke', 'transparent');
        hitbox.style.pointerEvents = 'all'; // Make it clickable
  
        ellipse.style.pointerEvents = 'none'; // Make it clickable
  
        // Attach click event to hitbox
        hitbox.addEventListener('click', callback);
  
        //me.addLabel(cx,cy,point.vpin, false)
  
        // Insert hitbox BEFORE visible ellipse so it doesn't cover it
        const parent = ellipse.parentNode; // Get actual parent node
        parent.insertBefore(hitbox, ellipse); // Insert relative to the correct parent
  
    }
    static addBackgroundStroke(pathElement, backgroundColor = 'black', backgroundWidth = 8, className = 'background-stroke') {
        if (!pathElement || pathElement.tagName !== 'path') {
          console.error('Invalid path element');
          return;
        }
  
        const svg = pathElement.ownerSVGElement;
        if (!svg) {
          console.error('Path is not in an SVG');
          return;
        }
  
        const backgroundPath = pathElement.cloneNode(false);
  
        // Remove ID to avoid duplication issues
        backgroundPath.removeAttribute('id');
  
        // Remove style so we can start fresh
        backgroundPath.removeAttribute('style');
  
        // Use style directly instead of individual attributes
        backgroundPath.setAttribute('style', `
          stroke: ${backgroundColor};
          stroke-width: ${backgroundWidth};
          fill: none;
          stroke-linecap: ${pathElement.getAttribute('stroke-linecap') || 'round'};
          stroke-linejoin: ${pathElement.getAttribute('stroke-linejoin') || 'round'};
        `.trim());
  
        // Add class if specified
        if (className) backgroundPath.classList.add(className);
  
        // Insert behind original
        pathElement.parentNode.insertBefore(backgroundPath, pathElement);
      }
      static removeSvgElementsByClass(className) {
        const elements = document.querySelectorAll(`svg .${className}`);
        elements.forEach(el => el.remove());
      }

      static setLineStoke(svgElement, strokeWidth, color) {
       // const svgElement = this.$refs.svgContainer?.querySelector(`#${elementId}`);
        if (svgElement) {
          if (strokeWidth) svgElement.style.strokeWidth = strokeWidth;
          if (color) svgElement.style.stroke = color;
        } else {
          console.log(`Element with ID "${elementId}" not found.`);
        }
      }

      static addPathClickTarget(path, onClick, extraClass = 'click-target') {
        const hitPath = path.cloneNode(false);
        hitPath.removeAttribute('id');
        hitPath.removeAttribute('style');
  
        hitPath.setAttribute('stroke', 'transparent');
        hitPath.setAttribute('stroke-width', 15); // Adjust thickness
        hitPath.setAttribute('fill', 'none');
        hitPath.setAttribute('pointer-events', 'stroke');
  
        if (extraClass) hitPath.classList.add(extraClass);
  
        path.parentNode.insertBefore(hitPath, path.nextSibling); // put it above the real path so it catches events
  
        hitPath.addEventListener('click', onClick);
      }

      static hexToRgba(hex, alpha = 1) {
        if (!hex) {
          return `rgba(0, 0, 0, ${alpha})`; // Default to black if no hex is provided
        }
        // Remove leading # if present
        hex = hex.replace(/^#/, '');
  
        // Expand shorthand form (e.g., "f00") to full form ("ff0000")
        if (hex.length === 3) {
          hex = hex.split('').map(char => char + char).join('');
        }
  
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
  
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
  }

