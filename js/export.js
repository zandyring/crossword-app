// JSON save/load and printable HTML export
var Export = {
  toJSON: function(puzzle) {
    var cells = [];
    for (var i = 0; i < puzzle.cells.length; i++) {
      cells.push({ black: puzzle.cells[i].black, letter: puzzle.cells[i].letter || '' });
    }
    return {
      version: 1,
      width: puzzle.width,
      height: puzzle.height,
      cells: cells,
      clues: puzzle.clues,
      metadata: puzzle.metadata
    };
  },

  fromJSON: function(data) {
    var cells = [];
    for (var i = 0; i < data.cells.length; i++) {
      cells.push({ black: !!data.cells[i].black, letter: data.cells[i].letter || '', number: null });
    }
    var puzzle = {
      width: data.width,
      height: data.height,
      cells: cells,
      clues: data.clues || { across: {}, down: {} },
      metadata: data.metadata || { title: '', author: '' }
    };
    Numbering.compute(puzzle);
    return puzzle;
  },

  save: function(puzzle) {
    var data = this.toJSON(puzzle);
    var title = puzzle.metadata.title || 'crossword';
    var filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
    downloadJSON(data, filename);
  },

  load: function(file) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        try {
          var data = JSON.parse(e.target.result);
          resolve(self.fromJSON(data));
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  },

  sharePuzzle: function(puzzle) {
    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;
    var slots = Numbering.getSlots(puzzle);

    // Build grid data: array of {black, number} for layout, answers encoded separately
    var gridData = [];
    var answers = [];
    for (var i = 0; i < cells.length; i++) {
      gridData.push({ black: cells[i].black, number: cells[i].number || 0 });
      answers.push(cells[i].black ? '.' : (cells[i].letter || ' '));
    }
    var encodedAnswers = btoa(answers.join(''));

    // Build clue data
    var clueData = { across: [], down: [] };
    for (var a = 0; a < slots.length; a++) {
      if (slots[a].direction === 'across') {
        clueData.across.push({
          number: slots[a].number,
          clue: (puzzle.clues.across && puzzle.clues.across[slots[a].number]) || '',
          cells: slots[a].cells
        });
      }
    }
    for (var d = 0; d < slots.length; d++) {
      if (slots[d].direction === 'down') {
        clueData.down.push({
          number: slots[d].number,
          clue: (puzzle.clues.down && puzzle.clues.down[slots[d].number]) || '',
          cells: slots[d].cells
        });
      }
    }

    var title = puzzle.metadata.title || 'Crossword Puzzle';
    var author = puzzle.metadata.author || '';
    var puzzleJSON = JSON.stringify({
      width: width,
      height: height,
      grid: gridData,
      clues: clueData,
      answers: encodedAnswers
    });

    var html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + this._esc(title) + '</title>\n' +
      '<style>\n' +
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f0; color: #1a1a1a; }\n' +
      '.header { text-align: center; padding: 16px; }\n' +
      '.header h1 { font-family: Georgia, serif; margin-bottom: 4px; }\n' +
      '.header .author { font-style: italic; color: #666; }\n' +
      '.header .timer { font-size: 14px; color: #888; margin-top: 8px; font-variant-numeric: tabular-nums; }\n' +
      '.controls { text-align: center; margin: 10px 0; }\n' +
      '.controls button { padding: 6px 16px; margin: 0 4px; border: 1px solid #555; border-radius: 4px; background: #444; color: #f0f0f0; font-size: 13px; cursor: pointer; }\n' +
      '.controls button:hover { background: #555; }\n' +
      '.main { display: flex; padding: 20px; gap: 24px; align-items: flex-start; justify-content: center; }\n' +
      '.grid { display: inline-grid; border: 2px solid #333; background: #333; gap: 1px; user-select: none; }\n' +
      '.cell { position: relative; background: #fff; display: flex; align-items: center; justify-content: center; font-family: Georgia, serif; font-weight: bold; cursor: pointer; text-transform: uppercase; }\n' +
      '.cell.black { background: #1a1a1a; cursor: default; }\n' +
      '.cell.selected { background: #ffda00 !important; }\n' +
      '.cell.active-word:not(.selected) { background: #a7d8ff; }\n' +
      '.cell .num { position: absolute; top: 1px; left: 2px; font-size: 0.28em; font-family: sans-serif; font-weight: 600; line-height: 1; color: #333; pointer-events: none; }\n' +
      '.cell .letter { font-size: 0.52em; pointer-events: none; }\n' +
      '.cell.wrong .letter { color: #c00; }\n' +
      '.cell.revealed .letter { color: #06a; }\n' +
      '.clue-panel { flex: 1; min-width: 260px; max-width: 400px; max-height: 80vh; overflow-y: auto; }\n' +
      '.clue-section h2 { font-family: Georgia, serif; font-size: 16px; padding-bottom: 4px; border-bottom: 2px solid #1a1a1a; margin-bottom: 8px; }\n' +
      '.clue-section { margin-bottom: 16px; }\n' +
      '.clue { padding: 4px 6px; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1.4; }\n' +
      '.clue:hover { background: #eee; }\n' +
      '.clue.active { background: #fff3c4; }\n' +
      '.clue .cn { font-weight: bold; min-width: 24px; display: inline-block; text-align: right; margin-right: 6px; }\n' +
      '@media (max-width: 700px) { .main { flex-direction: column; align-items: center; } .clue-panel { max-width: 100%; max-height: none; } }\n' +
      '</style>\n</head><body>\n' +
      '<div class="header">\n' +
      '  <h1>' + this._esc(title) + '</h1>\n' +
      (author ? '  <div class="author">By ' + this._esc(author) + '</div>\n' : '') +
      '  <div class="timer" id="timer">0:00</div>\n' +
      '</div>\n' +
      '<div class="controls">\n' +
      '  <button onclick="checkPuzzle()">Check Puzzle</button>\n' +
      '  <button onclick="revealPuzzle()">Reveal Puzzle</button>\n' +
      '</div>\n' +
      '<div class="main">\n' +
      '  <div id="grid" class="grid"></div>\n' +
      '  <div class="clue-panel">\n' +
      '    <div class="clue-section"><h2>Across</h2><div id="clues-across"></div></div>\n' +
      '    <div class="clue-section"><h2>Down</h2><div id="clues-down"></div></div>\n' +
      '  </div>\n' +
      '</div>\n' +
      '<script>\n' +
      'var P=' + puzzleJSON + ';\n' +
      'var W=P.width, H=P.height, sel=null, dir="across", letters=[], startTime=Date.now();\n' +
      'var answers=atob(P.answers).split("");\n' +
      '\n' +
      '// Timer\n' +
      'setInterval(function(){var s=Math.floor((Date.now()-startTime)/1000);var m=Math.floor(s/60);s=s%60;document.getElementById("timer").textContent=m+":"+(s<10?"0":"")+s;},1000);\n' +
      '\n' +
      '// Init letters array\n' +
      'for(var i=0;i<P.grid.length;i++) letters.push("");\n' +
      '\n' +
      '// Render grid\n' +
      'function renderGrid(){\n' +
      '  var g=document.getElementById("grid");\n' +
      '  var cs=Math.min(Math.floor((window.innerWidth-340)/W),Math.floor((window.innerHeight-200)/H),42);\n' +
      '  cs=Math.max(cs,22);\n' +
      '  g.style.gridTemplateColumns="repeat("+W+","+cs+"px)";\n' +
      '  g.style.gridTemplateRows="repeat("+H+","+cs+"px)";\n' +
      '  g.innerHTML="";\n' +
      '  for(var i=0;i<P.grid.length;i++){\n' +
      '    var d=document.createElement("div");\n' +
      '    d.className="cell"+(P.grid[i].black?" black":"");\n' +
      '    d.dataset.idx=i;\n' +
      '    if(P.grid[i].number)d.innerHTML+=\'<span class="num">\'+P.grid[i].number+"</span>";\n' +
      '    if(!P.grid[i].black){\n' +
      '      d.innerHTML+=\'<span class="letter" id="L\'+i+\'">\'+letters[i]+"</span>";\n' +
      '      d.onclick=(function(idx){return function(){cellClick(idx);};})(i);\n' +
      '    }\n' +
      '    g.appendChild(d);\n' +
      '  }\n' +
      '  updateHighlights();\n' +
      '}\n' +
      '\n' +
      '// Find the slot (word) containing a cell index in a given direction\n' +
      'function findSlot(idx,direction){\n' +
      '  var list=P.clues[direction];\n' +
      '  for(var i=0;i<list.length;i++){if(list[i].cells.indexOf(idx)>=0)return list[i];}\n' +
      '  return null;\n' +
      '}\n' +
      '\n' +
      'function cellClick(idx){\n' +
      '  if(sel===idx){dir=(dir==="across"?"down":"across");if(!findSlot(idx,dir)){dir=(dir==="across"?"down":"across");}}\n' +
      '  else{sel=idx;if(!findSlot(idx,dir)){dir=(dir==="across"?"down":"across");}}\n' +
      '  updateHighlights();\n' +
      '}\n' +
      '\n' +
      'function updateHighlights(){\n' +
      '  var cells=document.querySelectorAll(".cell");\n' +
      '  for(var i=0;i<cells.length;i++){cells[i].classList.remove("selected","active-word");}\n' +
      '  document.querySelectorAll(".clue").forEach(function(c){c.classList.remove("active");});\n' +
      '  if(sel===null)return;\n' +
      '  cells[sel].classList.add("selected");\n' +
      '  var slot=findSlot(sel,dir);\n' +
      '  if(slot){\n' +
      '    for(var i=0;i<slot.cells.length;i++){cells[slot.cells[i]].classList.add("active-word");}\n' +
      '    var ce=document.getElementById("clue-"+dir+"-"+slot.number);\n' +
      '    if(ce){ce.classList.add("active");ce.scrollIntoView({block:"nearest"});}\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '// Render clues\n' +
      'function renderClues(){\n' +
      '  ["across","down"].forEach(function(d){\n' +
      '    var container=document.getElementById("clues-"+d);\n' +
      '    container.innerHTML="";\n' +
      '    P.clues[d].forEach(function(c){\n' +
      '      var div=document.createElement("div");\n' +
      '      div.className="clue";\n' +
      '      div.id="clue-"+d+"-"+c.number;\n' +
      '      div.innerHTML=\'<span class="cn">\'+c.number+".</span> "+esc(c.clue);\n' +
      '      div.onclick=function(){sel=c.cells[0];dir=d;updateHighlights();};\n' +
      '      container.appendChild(div);\n' +
      '    });\n' +
      '  });\n' +
      '}\n' +
      '\n' +
      'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}\n' +
      '\n' +
      '// Keyboard\n' +
      'document.addEventListener("keydown",function(e){\n' +
      '  if(sel===null)return;\n' +
      '  if(e.key.length===1&&/^[a-zA-Z]$/.test(e.key)){\n' +
      '    e.preventDefault();\n' +
      '    var c=document.querySelector(".cell[data-idx=\\""+sel+"\\"]");\n' +
      '    if(c){c.classList.remove("wrong","revealed");}\n' +
      '    letters[sel]=e.key.toUpperCase();\n' +
      '    document.getElementById("L"+sel).textContent=letters[sel];\n' +
      '    advance(1);\n' +
      '  }else if(e.key==="Backspace"){\n' +
      '    e.preventDefault();\n' +
      '    if(letters[sel]){letters[sel]="";document.getElementById("L"+sel).textContent="";}\n' +
      '    else{advance(-1);}\n' +
      '  }else if(e.key==="Delete"){\n' +
      '    e.preventDefault();letters[sel]="";document.getElementById("L"+sel).textContent="";\n' +
      '  }else if(e.key===" "){\n' +
      '    e.preventDefault();dir=(dir==="across"?"down":"across");if(!findSlot(sel,dir)){dir=(dir==="across"?"down":"across");}updateHighlights();\n' +
      '  }else if(e.key==="Tab"){\n' +
      '    e.preventDefault();tabMove(e.shiftKey?-1:1);\n' +
      '  }else if(e.key.startsWith("Arrow")){\n' +
      '    e.preventDefault();arrowMove(e.key);\n' +
      '  }\n' +
      '});\n' +
      '\n' +
      'function advance(step){\n' +
      '  var slot=findSlot(sel,dir);\n' +
      '  if(!slot)return;\n' +
      '  var pos=slot.cells.indexOf(sel);\n' +
      '  var next=pos+step;\n' +
      '  if(next>=0&&next<slot.cells.length){sel=slot.cells[next];updateHighlights();}\n' +
      '}\n' +
      '\n' +
      'function arrowMove(key){\n' +
      '  var r=Math.floor(sel/W),c=sel%W;\n' +
      '  if(key==="ArrowRight"){dir="across";c++;}else if(key==="ArrowLeft"){dir="across";c--;}\n' +
      '  else if(key==="ArrowDown"){dir="down";r++;}else if(key==="ArrowUp"){dir="down";r--;}\n' +
      '  if(r>=0&&r<H&&c>=0&&c<W){var ni=r*W+c;if(!P.grid[ni].black){sel=ni;}}\n' +
      '  updateHighlights();\n' +
      '}\n' +
      '\n' +
      'function tabMove(step){\n' +
      '  var list=P.clues[dir];\n' +
      '  var curSlot=findSlot(sel,dir);\n' +
      '  var idx=-1;\n' +
      '  for(var i=0;i<list.length;i++){if(list[i].number===curSlot.number){idx=i;break;}}\n' +
      '  idx+=step;\n' +
      '  if(idx<0){dir=(dir==="across"?"down":"across");list=P.clues[dir];idx=list.length-1;}\n' +
      '  else if(idx>=list.length){dir=(dir==="across"?"down":"across");list=P.clues[dir];idx=0;}\n' +
      '  sel=list[idx].cells[0];\n' +
      '  updateHighlights();\n' +
      '}\n' +
      '\n' +
      'function checkPuzzle(){\n' +
      '  var cells=document.querySelectorAll(".cell");\n' +
      '  for(var i=0;i<P.grid.length;i++){\n' +
      '    if(P.grid[i].black)continue;\n' +
      '    cells[i].classList.remove("wrong");\n' +
      '    if(letters[i]&&letters[i]!==answers[i]){cells[i].classList.add("wrong");}\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'function revealPuzzle(){\n' +
      '  var cells=document.querySelectorAll(".cell");\n' +
      '  for(var i=0;i<P.grid.length;i++){\n' +
      '    if(P.grid[i].black||answers[i]===" ")continue;\n' +
      '    letters[i]=answers[i];\n' +
      '    document.getElementById("L"+i).textContent=answers[i];\n' +
      '    cells[i].classList.remove("wrong");\n' +
      '    if(!cells[i].classList.contains("revealed"))cells[i].classList.add("revealed");\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'renderGrid();\n' +
      'renderClues();\n' +
      'window.addEventListener("resize",renderGrid);\n' +
      '<\/script>\n' +
      '</body></html>';

    // Download as file
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var filename = (puzzle.metadata.title || 'crossword').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_puzzle.html';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  _esc: function(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  printHTML: function(puzzle) {
    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;
    var slots = Numbering.getSlots(puzzle);
    var cellSize = Math.floor(500 / width);

    var gridHTML = '<table style="border-collapse:collapse;border:2px solid #000;margin:20px auto;">';
    for (var r = 0; r < height; r++) {
      gridHTML += '<tr>';
      for (var c = 0; c < width; c++) {
        var cell = cells[r * width + c];
        if (cell.black) {
          gridHTML += '<td style="width:' + cellSize + 'px;height:' + cellSize + 'px;background:#000;border:1px solid #000;"></td>';
        } else {
          var numHTML = cell.number ? '<span style="position:absolute;top:1px;left:2px;font-size:8px;">' + cell.number + '</span>' : '';
          gridHTML += '<td style="width:' + cellSize + 'px;height:' + cellSize + 'px;border:1px solid #000;position:relative;vertical-align:middle;text-align:center;">' + numHTML + '</td>';
        }
      }
      gridHTML += '</tr>';
    }
    gridHTML += '</table>';

    var cluesHTML = '<div style="display:flex;gap:40px;max-width:600px;margin:20px auto;font-family:Georgia,serif;font-size:12px;">';
    cluesHTML += '<div style="flex:1;"><h3>Across</h3>';
    for (var a = 0; a < slots.length; a++) {
      if (slots[a].direction !== 'across') continue;
      var aClue = (puzzle.clues.across && puzzle.clues.across[slots[a].number]) || '';
      cluesHTML += '<p><strong>' + slots[a].number + '.</strong> ' + aClue + '</p>';
    }
    cluesHTML += '</div><div style="flex:1;"><h3>Down</h3>';
    for (var d = 0; d < slots.length; d++) {
      if (slots[d].direction !== 'down') continue;
      var dClue = (puzzle.clues.down && puzzle.clues.down[slots[d].number]) || '';
      cluesHTML += '<p><strong>' + slots[d].number + '.</strong> ' + dClue + '</p>';
    }
    cluesHTML += '</div></div>';

    var title = puzzle.metadata.title || 'Crossword Puzzle';
    var author = puzzle.metadata.author ? '<p style="text-align:center;font-style:italic;margin:0;">By ' + puzzle.metadata.author + '</p>' : '';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<style>@media print { body { margin: 0.5in; } } body { font-family: Georgia, serif; }</style>' +
      '</head><body>' +
      '<h1 style="text-align:center;margin-bottom:4px;">' + title + '</h1>' +
      author + gridHTML + cluesHTML +
      '</body></html>';

    downloadHTML(html);
  }
};
