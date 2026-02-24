// Auto-fill solver — AC-3 + backtracking with MRV, position-indexed lookups, Web Worker
var AutoFill = {
  worker: null,

  createWorkerBlob: function() {
    var code = `
var cancelled = false;
var startTime = 0;
var TIMEOUT = 30000;

// Position index: posIndex[length][position][letter] = Set of word indices
var wordsByLen = {};   // length -> [words]
var scoresByLen = {};   // length -> [scores] (parallel to wordsByLen)
var posIndex = {};     // length -> position -> letter -> Set<wordIndex>

self.onmessage = function(e) {
  if (e.data.type === "cancel") { cancelled = true; return; }
  if (e.data.type === "solve") {
    cancelled = false;
    startTime = Date.now();
    buildIndex(e.data.words, e.data.scores);
    var result = solve(e.data.slots, e.data.cells, e.data.width);
    self.postMessage({ type: "done", result: result });
  }
};

function buildIndex(words, scores) {
  wordsByLen = {};
  scoresByLen = {};
  posIndex = {};
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var sc = scores ? scores[i] : 50;
    var len = w.length;
    if (!wordsByLen[len]) {
      wordsByLen[len] = [];
      scoresByLen[len] = [];
      posIndex[len] = {};
    }
    var idx = wordsByLen[len].length;
    wordsByLen[len].push(w);
    scoresByLen[len].push(sc);
    for (var p = 0; p < len; p++) {
      if (!posIndex[len][p]) posIndex[len][p] = {};
      var ch = w[p];
      if (!posIndex[len][p][ch]) posIndex[len][p][ch] = [];
      posIndex[len][p][ch].push(idx);
    }
  }
}

// Find matching word indices for a pattern using position index (fast intersection)
function findMatchingIndices(len, constraints) {
  // constraints: array of {pos, letter}
  if (!wordsByLen[len]) return [];
  if (constraints.length === 0) {
    var all = [];
    for (var i = 0; i < wordsByLen[len].length; i++) all.push(i);
    return all;
  }

  // Start with the most restrictive constraint (smallest set)
  var sets = [];
  for (var c = 0; c < constraints.length; c++) {
    var pos = constraints[c].pos;
    var letter = constraints[c].letter;
    if (!posIndex[len] || !posIndex[len][pos] || !posIndex[len][pos][letter]) return [];
    sets.push(posIndex[len][pos][letter]);
  }

  // Sort by size ascending for fastest intersection
  sets.sort(function(a, b) { return a.length - b.length; });

  // Intersect
  var result = sets[0].slice();
  for (var s = 1; s < sets.length; s++) {
    var setB = sets[s];
    var setBSet = {};
    for (var j = 0; j < setB.length; j++) setBSet[setB[j]] = true;
    var filtered = [];
    for (var k = 0; k < result.length; k++) {
      if (setBSet[result[k]]) filtered.push(result[k]);
    }
    result = filtered;
    if (result.length === 0) return result;
  }
  return result;
}

// Shuffle array in-place (Fisher-Yates)
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function solve(slots, cells, width) {
  if (slots.length === 0) return cells;

  // Build crossing map: for each slot, list of {myPos, otherSlot, otherPos}
  var crossings = [];
  for (var i = 0; i < slots.length; i++) crossings.push([]);

  var cellToSlot = {}; // cellIndex -> [{slot, pos}]
  for (var si = 0; si < slots.length; si++) {
    for (var pi = 0; pi < slots[si].cells.length; pi++) {
      var ci = slots[si].cells[pi];
      if (!cellToSlot[ci]) cellToSlot[ci] = [];
      // Link to all previous slots at this cell
      for (var x = 0; x < cellToSlot[ci].length; x++) {
        var other = cellToSlot[ci][x];
        crossings[si].push({ myPos: pi, otherSlot: other.slot, otherPos: other.pos });
        crossings[other.slot].push({ myPos: other.pos, otherSlot: si, otherPos: pi });
      }
      cellToSlot[ci].push({ slot: si, pos: pi });
    }
  }

  // Build initial domains (indices into wordsByLen[slot.length])
  var domains = [];
  for (var d = 0; d < slots.length; d++) {
    var slot = slots[d];
    var len = slot.length;
    // Get pre-filled letter constraints from grid
    var fixed = [];
    for (var fp = 0; fp < slot.cells.length; fp++) {
      if (cells[slot.cells[fp]] && cells[slot.cells[fp]] !== "" && cells[slot.cells[fp]] !== "#") {
        fixed.push({ pos: fp, letter: cells[slot.cells[fp]] });
      }
    }
    var indices = findMatchingIndices(len, fixed);
    // Sort by score descending with jitter — prefer common words but
    // add randomness within similar scores so solver explores varied paths
    var lenScores = scoresByLen[len];
    if (lenScores) {
      indices.sort(function(a, b) {
        var sa = (lenScores[a] || 0) + Math.random() * 15;
        var sb = (lenScores[b] || 0) + Math.random() * 15;
        return sb - sa;
      });
    } else {
      shuffle(indices);
    }
    domains.push(indices);
  }

  // Check for empty domains
  for (var e = 0; e < domains.length; e++) {
    if (domains[e].length === 0) {
      self.postMessage({ type: "progress", filled: 0, total: slots.length, msg: "No words fit slot " + slots[e].number + slots[e].direction[0].toUpperCase() });
      return null;
    }
  }

  // AC-3 initial pass
  domains = ac3(domains, slots, crossings);
  if (!domains) return null;

  // Backtrack
  var assignment = []; // slotIndex -> wordIndex or -1
  for (var a = 0; a < slots.length; a++) assignment.push(-1);

  // Pre-assign slots with domain size 1
  for (var p = 0; p < domains.length; p++) {
    if (domains[p].length === 1) assignment[p] = domains[p][0];
    if (domains[p].length === 0) return null;
  }

  var result = backtrack(slots, cells.slice(), domains, crossings, assignment, 0);
  return result;
}

function ac3(domains, slots, crossings) {
  // Queue of [slotA, slotB] arcs to check
  var queue = [];
  for (var i = 0; i < crossings.length; i++) {
    for (var j = 0; j < crossings[i].length; j++) {
      queue.push([i, crossings[i][j]]);
    }
  }

  var iterations = 0;
  while (queue.length > 0) {
    if (cancelled) return null;
    if (++iterations > 200000) break; // safety

    var arc = queue.shift();
    var si = arc[0];
    var crossing = arc[1]; // {myPos, otherSlot, otherPos}
    var sj = crossing.otherSlot;
    var myPos = crossing.myPos;
    var otherPos = crossing.otherPos;

    // Find which letters are possible at otherPos in domain of sj
    var otherLetters = {};
    var wordsJ = wordsByLen[slots[sj].length];
    for (var b = 0; b < domains[sj].length; b++) {
      otherLetters[wordsJ[domains[sj][b]][otherPos]] = true;
    }

    // Filter domain of si to only words whose myPos letter is in otherLetters
    var wordsI = wordsByLen[slots[si].length];
    var newDomain = [];
    var changed = false;
    for (var a = 0; a < domains[si].length; a++) {
      if (otherLetters[wordsI[domains[si][a]][myPos]]) {
        newDomain.push(domains[si][a]);
      } else {
        changed = true;
      }
    }

    if (changed) {
      domains[si] = newDomain;
      if (newDomain.length === 0) return null;
      // Re-enqueue arcs pointing to si
      for (var k = 0; k < crossings[si].length; k++) {
        if (crossings[si][k].otherSlot !== sj) {
          queue.push([crossings[si][k].otherSlot, { myPos: crossings[si][k].otherPos, otherSlot: si, otherPos: crossings[si][k].myPos }]);
        }
      }
    }
  }
  return domains;
}

function backtrack(slots, cells, domains, crossings, assignment, depth) {
  if (cancelled || Date.now() - startTime > TIMEOUT) return null;

  // Pick unassigned slot with smallest domain (MRV)
  var bestSlot = -1;
  var bestSize = Infinity;
  for (var i = 0; i < slots.length; i++) {
    if (assignment[i] === -1 && domains[i].length < bestSize) {
      bestSize = domains[i].length;
      bestSlot = i;
    }
  }

  if (bestSlot === -1) {
    // All assigned — build result
    for (var f = 0; f < slots.length; f++) {
      var word = wordsByLen[slots[f].length][assignment[f]];
      for (var p = 0; p < slots[f].cells.length; p++) {
        cells[slots[f].cells[p]] = word[p];
      }
    }
    return cells;
  }

  if (bestSize === 0) return null;

  // Progress update
  if (depth % 3 === 0) {
    var filled = 0;
    for (var fc = 0; fc < assignment.length; fc++) { if (assignment[fc] !== -1) filled++; }
    self.postMessage({ type: "progress", filled: filled, total: slots.length });
  }

  var slotWords = wordsByLen[slots[bestSlot].length];
  var usedWords = {};
  for (var u = 0; u < assignment.length; u++) {
    if (assignment[u] !== -1 && slots[u].length === slots[bestSlot].length) {
      usedWords[assignment[u]] = true;
    }
  }

  // Try each word in domain
  for (var w = 0; w < domains[bestSlot].length; w++) {
    if (cancelled || Date.now() - startTime > TIMEOUT) return null;

    var wordIdx = domains[bestSlot][w];
    if (usedWords[wordIdx]) continue; // no duplicate words

    var word = slotWords[wordIdx];

    // Forward check: for each crossing slot, filter its domain
    var ok = true;
    var savedDomains = [];
    for (var c = 0; c < crossings[bestSlot].length; c++) {
      var cr = crossings[bestSlot][c];
      var otherSlot = cr.otherSlot;
      if (assignment[otherSlot] !== -1) {
        // Already assigned — just check consistency
        var otherWord = wordsByLen[slots[otherSlot].length][assignment[otherSlot]];
        if (otherWord[cr.otherPos] !== word[cr.myPos]) { ok = false; break; }
        continue;
      }
      var myLetter = word[cr.myPos];
      var otherWords = wordsByLen[slots[otherSlot].length];
      var newDom = [];
      for (var od = 0; od < domains[otherSlot].length; od++) {
        if (otherWords[domains[otherSlot][od]][cr.otherPos] === myLetter) {
          newDom.push(domains[otherSlot][od]);
        }
      }
      if (newDom.length === 0) { ok = false; break; }
      savedDomains.push({ slot: otherSlot, oldDomain: domains[otherSlot] });
      domains[otherSlot] = newDom;
    }

    if (ok) {
      assignment[bestSlot] = wordIdx;
      var result = backtrack(slots, cells, domains, crossings, assignment, depth + 1);
      if (result) return result;
      assignment[bestSlot] = -1;
    }

    // Restore domains
    for (var r = 0; r < savedDomains.length; r++) {
      domains[savedDomains[r].slot] = savedDomains[r].oldDomain;
    }
  }

  return null;
}
`;
    return new Blob([code], { type: 'application/javascript' });
  },

  run: function(puzzle) {
    if (!WordList.loaded) {
      alert('Word list not loaded yet. Serve the app via HTTP: python3 -m http.server 8000');
      return;
    }

    var slots = Numbering.getSlots(puzzle);
    if (slots.length === 0) return;

    var cellLetters = [];
    for (var i = 0; i < puzzle.cells.length; i++) {
      cellLetters.push(puzzle.cells[i].black ? '#' : (puzzle.cells[i].letter || ''));
    }

    var workerSlots = [];
    for (var s = 0; s < slots.length; s++) {
      workerSlots.push({
        cells: slots[s].cells,
        length: slots[s].length,
        direction: slots[s].direction,
        number: slots[s].number
      });
    }

    var blob = this.createWorkerBlob();
    var url = URL.createObjectURL(blob);
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);

    var statusEl = document.getElementById('autofill-status');
    var cancelBtn = document.getElementById('btn-cancel-autofill');
    var fillBtn = document.getElementById('btn-autofill');
    fillBtn.disabled = true;
    cancelBtn.disabled = false;
    statusEl.textContent = 'Solving...';

    var self = this;
    this.worker.onmessage = function(e) {
      if (e.data.type === 'progress') {
        var msg = 'Solving... (' + e.data.filled + '/' + e.data.total + ' slots)';
        if (e.data.msg) msg += ' — ' + e.data.msg;
        statusEl.textContent = msg;
      } else if (e.data.type === 'done') {
        fillBtn.disabled = false;
        cancelBtn.disabled = true;
        self.worker.terminate();
        self.worker = null;

        if (e.data.result) {
          App.pushUndo();
          for (var i = 0; i < puzzle.cells.length; i++) {
            if (!puzzle.cells[i].black && e.data.result[i] && e.data.result[i] !== '#') {
              puzzle.cells[i].letter = e.data.result[i];
            }
          }
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          statusEl.textContent = 'Filled!';
          App.onCellEdit();
        } else {
          statusEl.textContent = 'No solution found.';
        }
        setTimeout(function() { statusEl.textContent = ''; }, 3000);
      }
    };

    var startTime = Date.now();
    this.worker.postMessage({
      type: 'solve',
      words: WordList.getWordsArray(),
      scores: WordList.getScoresArray(),
      slots: workerSlots,
      cells: cellLetters,
      width: puzzle.width
    });
  },

  cancel: function() {
    if (this.worker) {
      this.worker.postMessage({ type: 'cancel' });
      this.worker.terminate();
      this.worker = null;
      document.getElementById('autofill-status').textContent = 'Cancelled.';
      document.getElementById('btn-autofill').disabled = false;
      document.getElementById('btn-cancel-autofill').disabled = true;
      setTimeout(function() { document.getElementById('autofill-status').textContent = ''; }, 2000);
    }
  }
};
