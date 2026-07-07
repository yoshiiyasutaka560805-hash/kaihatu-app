'use strict';

/**
 * Shapes.js - generic descriptor -> SVG rendering engine.
 * A "ShapeDescriptor" is { type, color, fill, size, rotation }.
 * A "ShapeSet" is an array of ShapeDescriptor (1+ shapes drawn together in one cell,
 * used for counting-type items).
 */
var Shapes = (function () {
  var COLORS = {
    navy: '#1d3557',
    coral: '#e76f51',
    teal: '#2a9d8f',
    amber: '#c98a12',
    plum: '#6a4c93',
    slate: '#495057',
  };

  var SIZE_R = { sm: 9, md: 14, lg: 19 };

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) {
        node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  // Inject shared <pattern> defs once so every inline <svg> in the document
  // can reference them by id (SVG ids are document-global).
  function injectDefs() {
    if (document.getElementById('shapes-pattern-defs')) return;
    var svg = el('svg', { id: 'shapes-pattern-defs', width: '0', height: '0', style: 'position:absolute;left:-9999px' });
    var defs = el('defs', {});
    Object.keys(COLORS).forEach(function (name) {
      var hex = COLORS[name];

      var stripe = el('pattern', {
        id: 'pattern-stripe-' + name,
        width: '6', height: '6',
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)',
      });
      stripe.appendChild(el('rect', { width: '6', height: '6', fill: '#ffffff' }));
      stripe.appendChild(el('rect', { width: '3', height: '6', fill: hex }));
      defs.appendChild(stripe);

      var dot = el('pattern', {
        id: 'pattern-dot-' + name,
        width: '7', height: '7',
        patternUnits: 'userSpaceOnUse',
      });
      dot.appendChild(el('rect', { width: '7', height: '7', fill: '#ffffff' }));
      dot.appendChild(el('circle', { cx: '3.5', cy: '3.5', r: '1.7', fill: hex }));
      defs.appendChild(dot);
    });
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  function regularPolygonPoints(cx, cy, r, sides, startDeg) {
    var pts = [];
    var start = (startDeg === undefined ? -90 : startDeg) * Math.PI / 180;
    for (var i = 0; i < sides; i++) {
      var angle = start + (i * 2 * Math.PI / sides);
      pts.push((cx + r * Math.cos(angle)).toFixed(2) + ',' + (cy + r * Math.sin(angle)).toFixed(2));
    }
    return pts.join(' ');
  }

  function starPoints(cx, cy, rOuter, rInner) {
    var pts = [];
    var start = -90 * Math.PI / 180;
    for (var i = 0; i < 10; i++) {
      var r = (i % 2 === 0) ? rOuter : rInner;
      var angle = start + (i * Math.PI / 5);
      pts.push((cx + r * Math.cos(angle)).toFixed(2) + ',' + (cy + r * Math.sin(angle)).toFixed(2));
    }
    return pts.join(' ');
  }

  function crossPoints(cx, cy, r) {
    var arm = r * 0.38;
    var out = r;
    var pts = [
      [cx - arm, cy - out], [cx + arm, cy - out],
      [cx + arm, cy - arm], [cx + out, cy - arm],
      [cx + out, cy + arm], [cx + arm, cy + arm],
      [cx + arm, cy + out], [cx - arm, cy + out],
      [cx - arm, cy + arm], [cx - out, cy + arm],
      [cx - out, cy - arm], [cx - arm, cy - arm],
    ];
    return pts.map(function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }).join(' ');
  }

  function fillAttrs(descriptor) {
    var hex = COLORS[descriptor.color] || '#333333';
    switch (descriptor.fill) {
      case 'outline':
        return { fill: 'none', stroke: hex, 'stroke-width': '3.5' };
      case 'striped':
        return { fill: 'url(#pattern-stripe-' + descriptor.color + ')', stroke: hex, 'stroke-width': '1.5' };
      case 'dotted':
        return { fill: 'url(#pattern-dot-' + descriptor.color + ')', stroke: hex, 'stroke-width': '1.5' };
      case 'solid':
      default:
        return { fill: hex, stroke: hex, 'stroke-width': '1' };
    }
  }

  // Draws one shape descriptor centered at (cx, cy) with radius r into svgEl.
  function renderShape(svgEl, descriptor, cx, cy, r) {
    var attrs = fillAttrs(descriptor);
    var rotation = descriptor.rotation || 0;
    var node;

    switch (descriptor.type) {
      case 'circle':
        node = el('circle', Object.assign({ cx: cx, cy: cy, r: r }, attrs));
        break;
      case 'square':
        node = el('polygon', Object.assign({
          points: [
            (cx - r) + ',' + (cy - r), (cx + r) + ',' + (cy - r),
            (cx + r) + ',' + (cy + r), (cx - r) + ',' + (cy + r),
          ].join(' '),
        }, attrs));
        break;
      case 'diamond':
        node = el('polygon', Object.assign({
          points: [
            cx + ',' + (cy - r), (cx + r) + ',' + cy,
            cx + ',' + (cy + r), (cx - r) + ',' + cy,
          ].join(' '),
        }, attrs));
        break;
      case 'triangle':
        node = el('polygon', Object.assign({ points: regularPolygonPoints(cx, cy, r * 1.05, 3) }, attrs));
        break;
      case 'pentagon':
        node = el('polygon', Object.assign({ points: regularPolygonPoints(cx, cy, r, 5) }, attrs));
        break;
      case 'hexagon':
        node = el('polygon', Object.assign({ points: regularPolygonPoints(cx, cy, r, 6) }, attrs));
        break;
      case 'star':
        node = el('polygon', Object.assign({ points: starPoints(cx, cy, r * 1.15, r * 0.45) }, attrs));
        break;
      case 'cross':
        node = el('polygon', Object.assign({ points: crossPoints(cx, cy, r) }, attrs));
        break;
      default:
        node = el('circle', Object.assign({ cx: cx, cy: cy, r: r }, attrs));
    }

    if (rotation) {
      node.setAttribute('transform', 'rotate(' + rotation + ' ' + cx + ' ' + cy + ')');
    }
    svgEl.appendChild(node);
  }

  function layoutPositions(n) {
    switch (n) {
      case 1: return [[50, 50]];
      case 2: return [[32, 50], [68, 50]];
      case 3: return [[50, 28], [28, 74], [72, 74]];
      case 4: return [[30, 30], [70, 30], [30, 70], [70, 70]];
      case 5: return [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]];
      default: return [[50, 50]];
    }
  }

  function radiusForCount(baseR, n) {
    if (n <= 1) return baseR;
    if (n === 2) return baseR * 0.75;
    return baseR * 0.6;
  }

  // Renders a ShapeSet (array of descriptors) into a fresh <svg> appended to `container`.
  function renderCell(container, shapeSet, sizePx) {
    var svg = el('svg', { viewBox: '0 0 100 100', width: sizePx, height: sizePx, class: 'shape-svg' });
    if (!shapeSet || shapeSet.length === 0) {
      container.appendChild(svg);
      return svg;
    }
    var n = shapeSet.length;
    var positions = layoutPositions(n);
    var baseR = SIZE_R[shapeSet[0].size] || SIZE_R.md;
    var r = radiusForCount(baseR, n);
    for (var i = 0; i < n; i++) {
      var pos = positions[i] || [50, 50];
      renderShape(svg, shapeSet[i], pos[0], pos[1], r);
    }
    container.appendChild(svg);
    return svg;
  }

  // Renders the dashed "blank" placeholder cell (universal, no translation needed).
  function renderBlank(container, sizePx) {
    var svg = el('svg', { viewBox: '0 0 100 100', width: sizePx, height: sizePx, class: 'shape-svg shape-blank' });
    svg.appendChild(el('rect', {
      x: 6, y: 6, width: 88, height: 88, rx: 6,
      fill: 'none', stroke: '#9aa3ab', 'stroke-width': 3, 'stroke-dasharray': '8 6',
    }));
    var text = el('text', {
      x: 50, y: 62, 'text-anchor': 'middle', 'font-size': 36, fill: '#6c757d', 'font-weight': 'bold',
    });
    text.textContent = '?';
    svg.appendChild(text);
    container.appendChild(svg);
    return svg;
  }

  return {
    COLORS: COLORS,
    injectDefs: injectDefs,
    renderCell: renderCell,
    renderBlank: renderBlank,
  };
})();
