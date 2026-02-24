// App bootstrap — wires all modules together
var App = {
  puzzle: null,
  mode: 'blocks', // 'blocks' (toggle black squares) or 'fill' (enter letters)
  symmetry: true,
  undoStack: [],
  redoStack: [],
  maxUndo: 50,
  autoSaveKey: 'crossword-builder-autosave',

  init: function() {
    console.log('App.init starting...');

    try {
      this.puzzle = this.loadAutoSave() || this.createPuzzle(15);
    } catch (e) {
      console.warn('Auto-save load failed, creating fresh puzzle', e);
      this.puzzle = this.createPuzzle(15);
    }

    Numbering.compute(this.puzzle);

    // Load word list (async, non-blocking)
    WordList.load().catch(function(e) {
      console.warn('Word list load failed:', e);
    });

    // Render
    this.renderAll();
    this.syncMetadataUI();

    // Toolbar events
    var self = this;

    document.getElementById('grid-size').value = this.puzzle.width;
    document.getElementById('grid-size').addEventListener('change', function(e) {
      var size = parseInt(e.target.value);
      if (confirm('Resize grid to ' + size + '\u00d7' + size + '? This will clear the current puzzle.')) {
        self.puzzle = self.createPuzzle(size);
        self.undoStack = [];
        self.redoStack = [];
        self.renderAll();
        self.autoSave();
      } else {
        e.target.value = self.puzzle.width;
      }
    });

    document.getElementById('btn-symmetry').addEventListener('click', function() {
      self.symmetry = !self.symmetry;
      this.classList.toggle('active', self.symmetry);
    });

    document.getElementById('btn-mode').addEventListener('click', function() {
      self.mode = (self.mode === 'blocks') ? 'fill' : 'blocks';
      this.textContent = 'Mode: ' + (self.mode === 'blocks' ? 'Blocks' : 'Fill');
      this.classList.toggle('active', self.mode === 'fill');
      if (self.mode === 'blocks') {
        Grid.selectedCell = null;
        Grid.updateHighlights();
      }
    });

    document.getElementById('btn-clear-letters').addEventListener('click', function() {
      if (!confirm('Clear all letters?')) return;
      self.pushUndo();
      for (var i = 0; i < self.puzzle.cells.length; i++) {
        if (!self.puzzle.cells[i].black) self.puzzle.cells[i].letter = '';
      }
      self.renderAll();
      self.autoSave();
    });

    document.getElementById('btn-clear-grid').addEventListener('click', function() {
      if (!confirm('Clear entire grid (black squares and letters)?')) return;
      self.pushUndo();
      for (var i = 0; i < self.puzzle.cells.length; i++) {
        self.puzzle.cells[i].black = false;
        self.puzzle.cells[i].letter = '';
        self.puzzle.cells[i].number = null;
      }
      self.onGridChange();
    });

    document.getElementById('btn-autofill').addEventListener('click', function() {
      AutoFill.run(self.puzzle);
    });
    document.getElementById('btn-cancel-autofill').addEventListener('click', function() {
      AutoFill.cancel();
    });

    document.getElementById('btn-undo').addEventListener('click', function() { self.undo(); });
    document.getElementById('btn-redo').addEventListener('click', function() { self.redo(); });

    document.getElementById('btn-save').addEventListener('click', function() {
      Export.save(self.puzzle);
    });
    document.getElementById('btn-load').addEventListener('click', function() {
      document.getElementById('file-input').click();
    });
    document.getElementById('file-input').addEventListener('change', function(e) {
      if (e.target.files.length) {
        Export.load(e.target.files[0]).then(function(puzzle) {
          self.puzzle = puzzle;
          self.undoStack = [];
          self.redoStack = [];
          self.renderAll();
          self.syncMetadataUI();
          self.autoSave();
        }).catch(function(err) {
          alert('Failed to load puzzle: ' + err.message);
        });
        e.target.value = '';
      }
    });

    document.getElementById('btn-print').addEventListener('click', function() {
      Export.printHTML(self.puzzle);
    });

    document.getElementById('btn-share').addEventListener('click', function() {
      Export.sharePuzzle(self.puzzle);
    });

    // Help modal
    document.getElementById('btn-help').addEventListener('click', function() {
      document.getElementById('help-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-help').addEventListener('click', function() {
      document.getElementById('help-modal').classList.add('hidden');
    });
    document.getElementById('help-modal').addEventListener('click', function(e) {
      if (e.target === document.getElementById('help-modal')) {
        document.getElementById('help-modal').classList.add('hidden');
      }
    });

    // Metadata
    document.getElementById('meta-title').addEventListener('input', function(e) {
      self.puzzle.metadata.title = e.target.value;
      self.autoSave();
    });
    document.getElementById('meta-author').addEventListener('input', function(e) {
      self.puzzle.metadata.author = e.target.value;
      self.autoSave();
    });

    // Global keyboard handler
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        self.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z'))) {
        e.preventDefault();
        self.redo();
        return;
      }
      if (e.key === 'Escape') {
        document.getElementById('help-modal').classList.add('hidden');
      }
      Grid.handleKeydown(e);
    });

    window.addEventListener('resize', function() {
      Grid.render(self.puzzle);
    });

    console.log('App.init complete. Grid: ' + this.puzzle.width + 'x' + this.puzzle.height);
  },

  createPuzzle: function(size) {
    var cells = [];
    for (var i = 0; i < size * size; i++) {
      cells.push({ black: false, letter: '', number: null });
    }
    return {
      width: size,
      height: size,
      cells: cells,
      clues: { across: {}, down: {} },
      metadata: { title: '', author: '' }
    };
  },

  renderAll: function() {
    Grid.render(this.puzzle);
    Clues.render(this.puzzle);
    this.updateUndoRedoButtons();
    this.validateGrid();
  },

  onGridChange: function() {
    Numbering.compute(this.puzzle);
    this.renderAll();
    this.autoSave();
  },

  onCellEdit: function() {
    Grid.render(this.puzzle);
    Clues.updateAnswers(this.puzzle);
    this.autoSave();
  },

  pushUndo: function() {
    this.undoStack.push(deepClone(this.puzzle));
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    this.redoStack = [];
    this.updateUndoRedoButtons();
  },

  undo: function() {
    if (!this.undoStack.length) return;
    this.redoStack.push(deepClone(this.puzzle));
    this.puzzle = this.undoStack.pop();
    Grid.selectedCell = null;
    this.renderAll();
    this.syncMetadataUI();
    this.autoSave();
  },

  redo: function() {
    if (!this.redoStack.length) return;
    this.undoStack.push(deepClone(this.puzzle));
    this.puzzle = this.redoStack.pop();
    Grid.selectedCell = null;
    this.renderAll();
    this.syncMetadataUI();
    this.autoSave();
  },

  updateUndoRedoButtons: function() {
    document.getElementById('btn-undo').disabled = this.undoStack.length === 0;
    document.getElementById('btn-redo').disabled = this.redoStack.length === 0;
  },

  autoSave: function() {
    try {
      localStorage.setItem(this.autoSaveKey, JSON.stringify(Export.toJSON(this.puzzle)));
    } catch (e) { /* ignore */ }
  },

  loadAutoSave: function() {
    try {
      var data = localStorage.getItem(this.autoSaveKey);
      if (data) return Export.fromJSON(JSON.parse(data));
    } catch (e) { /* ignore */ }
    return null;
  },

  syncMetadataUI: function() {
    document.getElementById('meta-title').value = this.puzzle.metadata.title || '';
    document.getElementById('meta-author').value = this.puzzle.metadata.author || '';
    document.getElementById('grid-size').value = this.puzzle.width;
  },

  validateGrid: function() {
    var warnings = [];
    var width = this.puzzle.width;
    var height = this.puzzle.height;
    var cells = this.puzzle.cells;

    // Check for short words (< 3 letters)
    for (var r = 0; r < height; r++) {
      for (var c = 0; c < width; c++) {
        if (cells[r * width + c].black) continue;

        var acrossLen = 0, downLen = 0;
        var cc = c;
        while (cc > 0 && !cells[r * width + (cc - 1)].black) cc--;
        while (cc < width && !cells[r * width + cc].black) { acrossLen++; cc++; }

        var rr = r;
        while (rr > 0 && !cells[(rr - 1) * width + c].black) rr--;
        while (rr < height && !cells[rr * width + c].black) { downLen++; rr++; }

        if (acrossLen < 3 && downLen < 3) {
          warnings.push('Cell at row ' + (r + 1) + ', col ' + (c + 1) + ': word too short');
        }
      }
    }

    // Check for disconnected regions
    var visited = {};
    var firstWhite = -1;
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i].black) { firstWhite = i; break; }
    }

    if (firstWhite >= 0) {
      var queue = [firstWhite];
      visited[firstWhite] = true;
      while (queue.length) {
        var idx = queue.shift();
        var qr = Math.floor(idx / width);
        var qc = idx % width;
        var neighbors = [[0,1],[0,-1],[1,0],[-1,0]];
        for (var n = 0; n < neighbors.length; n++) {
          var nr = qr + neighbors[n][0];
          var nc = qc + neighbors[n][1];
          if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
            var ni = nr * width + nc;
            if (!cells[ni].black && !visited[ni]) {
              visited[ni] = true;
              queue.push(ni);
            }
          }
        }
      }

      var visitedCount = Object.keys(visited).length;
      var totalWhite = 0;
      for (var tw = 0; tw < cells.length; tw++) {
        if (!cells[tw].black) totalWhite++;
      }
      if (visitedCount < totalWhite) {
        warnings.push('Grid has disconnected regions');
      }
    }

    var warningsEl = document.getElementById('grid-warnings');
    if (warningsEl) {
      warningsEl.innerHTML = warnings.map(function(w) {
        return '<div class="warning">' + w + '</div>';
      }).join('');
    }
  }
};

// Boot
document.addEventListener('DOMContentLoaded', function() {
  try {
    App.init();
  } catch (e) {
    console.error('App.init failed:', e);
    var banner = document.getElementById('error-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = 'Init error: ' + e.message;
    }
  }
});
