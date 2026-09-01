define(['local_tella_workshop/math'], function (math) {
    var GRID = 80;
    var LEVELS = 7;

    function buildGrid(config) {
        var range = math.plotRange(config);
        var cells = [];
        var minP = Infinity;
        var maxP = -Infinity;
        var i;
        var j;
        var x;
        var y;
        var p;
        for (i = 0; i <= GRID; i++) {
            cells[i] = [];
            x = range.xMin + (range.xMax - range.xMin) * i / GRID;
            for (j = 0; j <= GRID; j++) {
                y = range.yMin + (range.yMax - range.yMin) * j / GRID;
                p = math.profit(x, y, config);
                cells[i][j] = p;
                if (p < minP) {
                    minP = p;
                }
                if (p > maxP) {
                    maxP = p;
                }
            }
        }
        return {cells: cells, minP: minP, maxP: maxP, range: range, config: config};
    }

    function colourFor(p, minP, maxP, alpha) {
        var t = (p - minP) / (maxP - minP || 1);
        var stops = [
            [55, 32, 105], [63, 72, 143], [42, 120, 142],
            [34, 168, 132], [122, 209, 81], [253, 231, 37]
        ];
        var scaled = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
        var index = Math.floor(scaled);
        var blend = scaled - index;
        var from = stops[index];
        var to = stops[Math.min(index + 1, stops.length - 1)];
        return 'rgba(' + Math.round(from[0] + (to[0] - from[0]) * blend) + ',' +
            Math.round(from[1] + (to[1] - from[1]) * blend) + ',' +
            Math.round(from[2] + (to[2] - from[2]) * blend) + ',' + (alpha == null ? 1 : alpha) + ')';
    }

    function compact(value) {
        var absolute = Math.abs(value);
        if (absolute >= 1000000) return (value / 1000000).toFixed(1).replace('.0', '') + 'm';
        if (absolute >= 1000) return Math.round(value / 1000) + 'k';
        return Math.round(value).toString();
    }

    function project(x, y, z, w, h, range, zScale, view) {
        var nx = (x - range.xMin) / (range.xMax - range.xMin || 1);
        var ny = (y - range.yMin) / (range.yMax - range.yMin || 1);
        view = view || {rotation: -0.72, elevation: 0.62, zoom: 1};
        var dx = nx - 0.5;
        var dy = ny - 0.5;
        var rx = dx * Math.cos(view.rotation) - dy * Math.sin(view.rotation);
        var ry = dx * Math.sin(view.rotation) + dy * Math.cos(view.rotation);
        var isoX = rx;
        var isoY = ry * Math.sin(view.elevation) - z * zScale * Math.cos(view.elevation);
        var cx = w * 0.5;
        var cy = h * 0.53;
        var scale = Math.min(w, h) * 0.86 * (view.zoom || 1);
        return {x: cx + isoX * scale, y: cy + isoY * scale};
    }

    function drawSurface(ctx, grid, marker, extras) {
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var range = grid.range;
        var view = (extras && extras.view) || null;
        var zScale = 0.55 / (Math.max(Math.abs(grid.maxP), Math.abs(grid.minP), 1));
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);
        var i;
        var j;
        var x0;
        var x1;
        var y0;
        var y1;
        var pts;
        var pAvg;
        for (i = 0; i < GRID; i++) {
            for (j = 0; j < GRID; j++) {
                x0 = range.xMin + (range.xMax - range.xMin) * i / GRID;
                x1 = range.xMin + (range.xMax - range.xMin) * (i + 1) / GRID;
                y0 = range.yMin + (range.yMax - range.yMin) * j / GRID;
                y1 = range.yMin + (range.yMax - range.yMin) * (j + 1) / GRID;
                pts = [
                    project(x0, y0, grid.cells[i][j], w, h, range, zScale, view),
                    project(x1, y0, grid.cells[i + 1][j], w, h, range, zScale, view),
                    project(x1, y1, grid.cells[i + 1][j + 1], w, h, range, zScale, view),
                    project(x0, y1, grid.cells[i][j + 1], w, h, range, zScale, view)
                ];
                pAvg = (grid.cells[i][j] + grid.cells[i + 1][j] + grid.cells[i + 1][j + 1] + grid.cells[i][j + 1]) / 4;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                ctx.lineTo(pts[1].x, pts[1].y);
                ctx.lineTo(pts[2].x, pts[2].y);
                ctx.lineTo(pts[3].x, pts[3].y);
                ctx.closePath();
                ctx.fillStyle = colourFor(pAvg, grid.minP, grid.maxP, 0.95);
                ctx.fill();
                if ((grid.cells[i][j] <= 0 && grid.cells[i + 1][j + 1] >= 0) || (grid.cells[i][j] >= 0 && grid.cells[i + 1][j + 1] <= 0)) {
                    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
                }
            }
        }
        drawAxes3d(ctx, range, w, h, zScale, extras && extras.labels, view);
        if (extras && extras.plane) {
            drawPlane(ctx, grid, extras.plane, zScale, view);
        }
        if (marker) {
            drawMarker3d(ctx, grid, marker.x, marker.y, zScale, view, extras && extras.slopes);
        }
        if (extras && extras.peak) {
            drawPeak3d(ctx, grid, extras.peak.x, extras.peak.y, zScale, view);
        }
        drawSurfaceLabels(ctx, grid, zScale, view);
    }

    function drawAxes3d(ctx, range, w, h, zScale, labels, view) {
        var a = project(range.xMin, range.yMin, 0, w, h, range, zScale, view);
        var b = project(range.xMax, range.yMin, 0, w, h, range, zScale, view);
        var c = project(range.xMin, range.yMax, 0, w, h, range, zScale, view);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText((labels && labels.unit1) || 'product 1 per day', b.x - 40, b.y + 16);
        ctx.fillText((labels && labels.unit2) || 'product 2 per day', c.x - 20, c.y + 16);
    }

    function drawMarker3d(ctx, grid, x, y, zScale, view, slopes) {
        var p = math.profit(x, y, grid.config);
        var pt = project(x, y, p, ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        var base = project(x, y, grid.minP, ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        ctx.strokeStyle = '#0f172a';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Current', pt.x + 10, pt.y - 7);
        if (slopes) {
            drawSlope3d(ctx, grid, x, y, p, 'x', slopes.x, zScale, view, '#f97316', '∂P/∂s');
            drawSlope3d(ctx, grid, x, y, p, 'y', slopes.y, zScale, view, '#22d3ee', '∂P/∂t');
        }
    }

    function drawPeak3d(ctx, grid, x, y, zScale, view) {
        var p = math.profit(x, y, grid.config);
        var pt = project(x, y, p, ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#111827';
        ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Best mix', pt.x + 9, pt.y - 7);
    }

    function drawPlane(ctx, grid, plane, zScale, view) {
        var range = grid.range;
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var k;
        var t;
        var x;
        var y;
        var p;
        var pt;
        ctx.beginPath();
        for (k = 0; k <= GRID; k++) {
            t = k / GRID;
            if (plane.axis === 'y') {
                y = plane.value;
                x = range.xMin + (range.xMax - range.xMin) * t;
            } else {
                x = plane.value;
                y = range.yMin + (range.yMax - range.yMin) * t;
            }
            p = math.profit(x, y, grid.config);
            pt = project(x, y, p, w, h, range, zScale, view);
            if (k === 0) {
                ctx.moveTo(pt.x, pt.y);
            } else {
                ctx.lineTo(pt.x, pt.y);
            }
        }
        var start;
        var end;
        if (plane.axis === 'y') {
            start = project(range.xMin, plane.value, grid.minP, w, h, range, zScale, view);
            end = project(range.xMax, plane.value, grid.minP, w, h, range, zScale, view);
        } else {
            start = project(plane.value, range.yMin, grid.minP, w, h, range, zScale, view);
            end = project(plane.value, range.yMax, grid.minP, w, h, range, zScale, view);
        }
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(start.x, start.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function drawSlope3d(ctx, grid, x, y, p, axis, slope, zScale, view, colour, label) {
        var span = (axis === 'x' ? grid.range.xMax - grid.range.xMin : grid.range.yMax - grid.range.yMin) * 0.09;
        var endX = axis === 'x' ? Math.min(grid.range.xMax, x + span) : x;
        var endY = axis === 'y' ? Math.min(grid.range.yMax, y + span) : y;
        var endP = p + slope * span;
        var a = project(x, y, p, ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        var b = project(endX, endY, endP, ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        var angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 8 * Math.cos(angle - 0.45), b.y - 8 * Math.sin(angle - 0.45));
        ctx.lineTo(b.x - 8 * Math.cos(angle + 0.45), b.y - 8 * Math.sin(angle + 0.45)); ctx.closePath(); ctx.fill();
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif'; ctx.fillText(label, b.x + 4, b.y - 5);
    }

    function drawSurfaceLabels(ctx, grid, zScale, view) {
        var low = project(grid.range.xMin, grid.range.yMin, math.profit(grid.range.xMin, grid.range.yMin, grid.config), ctx.canvas.width, ctx.canvas.height, grid.range, zScale, view);
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(low.x - 5, low.y - 17, 72, 20);
        ctx.fillStyle = '#312e81'; ctx.font = '600 11px "Segoe UI", system-ui, sans-serif'; ctx.fillText('LOW / LOSS', low.x, low.y - 3);
    }

    function drawContour(ctx, grid, marker, extras) {
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var padL = 56;
        var padB = 40;
        var padT = 16;
        var padR = 22;
        var plotW = w - padL - padR;
        var plotH = h - padT - padB;
        var range = grid.range;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);
        var i;
        var j;
        var pAvg;
        var level;
        var cw = plotW / GRID;
        var ch = plotH / GRID;
        for (i = 0; i < GRID; i++) {
            for (j = 0; j < GRID; j++) {
                pAvg = (grid.cells[i][j] + grid.cells[i + 1][j] + grid.cells[i + 1][j + 1] + grid.cells[i][j + 1]) / 4;
                level = Math.floor(((pAvg - grid.minP) / (grid.maxP - grid.minP || 1)) * (LEVELS - 1));
                ctx.fillStyle = colourFor(grid.minP + level * (grid.maxP - grid.minP) / (LEVELS - 1), grid.minP, grid.maxP, 1);
                ctx.fillRect(padL + i * cw, padT + (GRID - 1 - j) * ch, cw + 0.5, ch + 0.5);
            }
        }
        drawZeroRing(ctx, grid, padL, padT, plotW, plotH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.fillStyle = '#475569';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        for (i = 0; i <= 4; i++) {
            var tickX = padL + plotW * i / 4;
            var tickY = padT + plotH * i / 4;
            ctx.beginPath();
            ctx.moveTo(tickX, padT);
            ctx.lineTo(tickX, padT + plotH);
            ctx.moveTo(padL, tickY);
            ctx.lineTo(padL + plotW, tickY);
            ctx.stroke();
            ctx.fillText(compact(range.xMin + (range.xMax - range.xMin) * i / 4), tickX - 8, padT + plotH + 17);
            ctx.fillText(compact(range.yMax - (range.yMax - range.yMin) * i / 4), padL - 38, tickY + 4);
        }
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(padL, padT, plotW, plotH);
        ctx.fillStyle = '#475569';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText((extras && extras.labels && extras.labels.unit1) || 'product 1 per day', padL, h - 12);
        ctx.save();
        ctx.translate(16, padT + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText((extras && extras.labels && extras.labels.unit2) || 'product 2 per day', 0, 0);
        ctx.restore();
        if (extras && extras.trail) {
            drawTrail(ctx, extras.trail, range, padL, padT, plotW, plotH);
        }
        if (extras && extras.peak) {
            var bestPoint = mapDot(ctx, extras.peak.x, extras.peak.y, range, padL, padT, plotW, plotH, '#2563eb', 6);
            ctx.fillStyle = '#1d4ed8';
            ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
            ctx.fillText('Best', bestPoint.x + 9, bestPoint.y - 7);
        }
        if (marker) {
            var currentPoint = mapDot(ctx, marker.x, marker.y, range, padL, padT, plotW, plotH, '#f59e0b', 7);
            ctx.fillStyle = '#7c2d12';
            ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
            ctx.fillText('Current', currentPoint.x + 10, currentPoint.y + 16);
            if (extras && extras.arrow) {
                drawArrow(ctx, marker, extras.arrow, range, padL, padT, plotW, plotH);
            }
        }
        return {padL: padL, padT: padT, plotW: plotW, plotH: plotH, range: range};
    }

    function mapPoint(x, y, range, padL, padT, plotW, plotH) {
        return {
            x: padL + (x - range.xMin) / (range.xMax - range.xMin || 1) * plotW,
            y: padT + (1 - (y - range.yMin) / (range.yMax - range.yMin || 1)) * plotH
        };
    }

    function mapDot(ctx, x, y, range, padL, padT, plotW, plotH, colour, r) {
        var pt = mapPoint(x, y, range, padL, padT, plotW, plotH);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        return pt;
    }

    function drawTrail(ctx, trail, range, padL, padT, plotW, plotH) {
        if (!trail.length) {
            return;
        }
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        trail.forEach(function (pt, idx) {
            var mapped = mapPoint(pt.x, pt.y, range, padL, padT, plotW, plotH);
            if (idx === 0) {
                ctx.moveTo(mapped.x, mapped.y);
            } else {
                ctx.lineTo(mapped.x, mapped.y);
            }
        });
        ctx.stroke();
    }

    function drawArrow(ctx, marker, arrow, range, padL, padT, plotW, plotH) {
        var mag = Math.sqrt(arrow.dx * arrow.dx + arrow.dy * arrow.dy);
        if (mag < 0.05) {
            return;
        }
        var start = mapPoint(marker.x, marker.y, range, padL, padT, plotW, plotH);
        var len = Math.min(70, 12 + mag * 4);
        var ux = arrow.dx / mag;
        var uy = arrow.dy / mag;
        var endX = start.x + ux * len;
        var endY = start.y - uy * len;
        ctx.strokeStyle = '#16a34a';
        ctx.fillStyle = '#16a34a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - ux * 8 - uy * 4, endY + uy * 8 - ux * 4);
        ctx.lineTo(endX - ux * 8 + uy * 4, endY + uy * 8 + ux * 4);
        ctx.closePath();
        ctx.fill();
    }

    function drawZeroRing(ctx, grid, padL, padT, plotW, plotH) {
        var range = grid.range;
        var i;
        var j;
        var a;
        var b;
        var c;
        var d;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1.5;
        for (i = 0; i < GRID; i++) {
            for (j = 0; j < GRID; j++) {
                a = grid.cells[i][j];
                b = grid.cells[i + 1][j];
                c = grid.cells[i + 1][j + 1];
                d = grid.cells[i][j + 1];
                if ((a < 0 && b < 0 && c < 0 && d < 0) || (a > 0 && b > 0 && c > 0 && d > 0)) {
                    continue;
                }
                ctx.strokeRect(
                    padL + i * plotW / GRID,
                    padT + (GRID - 1 - j) * plotH / GRID,
                    plotW / GRID,
                    plotH / GRID
                );
            }
        }
    }

    function drawSlice(ctx, config, frozenAxis, frozenValue, currentFree, labels) {
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var padL = 58;
        var padB = 42;
        var padT = 16;
        var padR = 16;
        var range = math.plotRange(config);
        var freeMin = frozenAxis === 'y' ? range.xMin : range.yMin;
        var freeMax = frozenAxis === 'y' ? range.xMax : range.yMax;
        var values = [];
        var k;
        var free;
        var x;
        var y;
        var p;
        var minP = Infinity;
        var maxP = -Infinity;
        for (k = 0; k <= 120; k++) {
            free = freeMin + (freeMax - freeMin) * k / 120;
            if (frozenAxis === 'y') {
                x = free;
                y = frozenValue;
            } else {
                x = frozenValue;
                y = free;
            }
            p = math.profit(x, y, config);
            values.push({free: free, p: p});
            if (p < minP) {
                minP = p;
            }
            if (p > maxP) {
                maxP = p;
            }
        }
        if (maxP === minP) {
            maxP = minP + 1;
        }
        // Leave headroom above the maximum so the curve, tangent, and current label
        // remain visible instead of being drawn into the canvas edge.
        var profitSpan = maxP - minP;
        var drawMin = minP - profitSpan * 0.06;
        var drawMax = maxP + profitSpan * 0.14;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(padL, padT, w - padL - padR, h - padT - padB);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        for (k = 0; k <= 4; k++) {
            var guideX = padL + (w - padL - padR) * k / 4;
            ctx.strokeStyle = '#eef2f7';
            ctx.beginPath();
            ctx.moveTo(guideX, padT);
            ctx.lineTo(guideX, h - padB);
            ctx.stroke();
            ctx.fillText(compact(freeMin + (freeMax - freeMin) * k / 4), guideX - 8, h - 18);
        }
        ctx.beginPath();
        values.forEach(function (pt, idx) {
            var px = padL + (pt.free - freeMin) / (freeMax - freeMin) * (w - padL - padR);
            var py = padT + (1 - (pt.p - drawMin) / (drawMax - drawMin)) * (h - padT - padB);
            if (idx === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        });
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        var slope = frozenAxis === 'y'
            ? math.slopeX(currentFree, frozenValue, config)
            : math.slopeY(frozenValue, currentFree, config);
        var cx = padL + (currentFree - freeMin) / (freeMax - freeMin) * (w - padL - padR);
        var cy = padT + (1 - (math.profit(
            frozenAxis === 'y' ? currentFree : frozenValue,
            frozenAxis === 'y' ? frozenValue : currentFree,
            config
        ) - drawMin) / (drawMax - drawMin)) * (h - padT - padB);
        var span = 50;
        var xScale = (w - padL - padR) / (freeMax - freeMin);
        var yScale = (h - padT - padB) / (drawMax - drawMin);
        ctx.beginPath();
        ctx.moveTo(cx - span, cy + slope * (span / xScale) * yScale);
        ctx.lineTo(cx + span, cy - slope * (span / xScale) * yScale);
        ctx.strokeStyle = slope >= 0 ? '#16a34a' : '#d97706';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, padT);
        ctx.lineTo(cx, h - padB);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#7c2d12';
        ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Current', cx + 9, cy - 9);
        ctx.fillStyle = '#475569';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(frozenAxis === 'y' ? (labels.unit1 || '') : (labels.unit2 || ''), padL, h - 14);
        ctx.fillText('daily profit (' + ((labels && labels.currency) || '$') + ')', 8, 14);
        ctx.fillText(compact(maxP), 8, padT + 12);
        ctx.fillText(compact(minP), 8, h - padB);
    }

    return {
        buildGrid: buildGrid,
        drawSurface: drawSurface,
        drawContour: drawContour,
        drawSlice: drawSlice
    };
});
