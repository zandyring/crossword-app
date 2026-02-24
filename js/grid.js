// Grid rendering, black-square editing, letter entry, keyboard navigation
var Grid = {
  selectedCell: null,
  direction: 'across',

  render: function(puzzle) {
    var gridEl = document.getElementById('grid');
    if (!gridEl) { console.error('Grid element not found'); return; }

    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;

    // Calculate cell size to fit well
    var availableWidth = Math.min(640, window.innerWidth - 340);
    var availableHeight = window.innerHeight - 160;
    var maxByWidth = Math.floor(availableWidth / width);
    var maxByHeight = Math.floor(availableHeight / height);
    var cellSize = Math.max(20, Math.min(maxByWidth, maxByHeight, 42));

    gridEl.style.gridTemplateColumns = 'repeat(' + width + ', ' + cellSize + 'px)';
    gridEl.style.gridTemplateRows = 'repeat(' + height + ', ' + cellSize + 'px)';
    gridEl.innerHTML = '';

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var div = document.createElement('div');
      div.className = 'cell' + (cell.black ? ' black' : '');
      div.setAttribute('data-index', i);
      div.style.width = cellSize + 'px';
      div.style.height = cellSize + 'px';
      div.style.fontSize = cellSize + 'px';

      if (!cell.black && cell.number) {
        var numSpan = document.createElement('span');
        numSpan.className = 'number';
        numSpan.textContent = cell.number;
        div.appendChild(numSpan);
      }

      if (!cell.black && cell.letter) {
        var letterSpan = document.createElement('span');
        letterSpan.className = 'letter';
        letterSpan.textContent = cell.letter;
        div.appendChild(letterSpan);
      }

      (function(index) {
        div.addEventListener('mousedown', function(e) {
          e.preventDefault();
          Grid.onCellClick(index);
        });
      })(i);

      gridEl.appendChild(div);
    }

    this.updateHighlights();
  },

  onCellClick: function(index) {
    var puzzle = App.puzzle;
    var cell = puzzle.cells[index];

    if (App.mode === 'blocks') {
      // Toggle black squares
      App.pushUndo();
      this.toggleBlack(index, puzzle);
      App.onGridChange();
      return;
    }

    // Fill mode — select cell for letter entry
    if (cell.black) return;

    if (this.selectedCell === index) {
      this.direction = (this.direction === 'across') ? 'down' : 'across';
    }

    this.selectedCell = index;
    this.updateHighlights();
    Clues.syncFromGrid(index, this.direction);
  },

  toggleBlack: function(index, puzzle) {
    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;
    var row = Math.floor(index / width);
    var col = index % width;
    var newState = !cells[index].black;

    cells[index].black = newState;
    cells[index].letter = '';

    if (App.symmetry) {
      var symRow = height - 1 - row;
      var symCol = width - 1 - col;
      var symIdx = symRow * width + symCol;
      if (symIdx !== index) {
        cells[symIdx].black = newState;
        cells[symIdx].letter = '';
      }
    }
  },

  handleKeydown: function(e) {
    var puzzle = App.puzzle;
    if (App.mode !== 'fill' || this.selectedCell === null) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;
    var idx = this.selectedCell;
    var row = Math.floor(idx / width);
    var col = idx % width;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.direction = 'across';
      this.moveToNextWhite(row, col, 0, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.direction = 'across';
      this.moveToNextWhite(row, col, 0, -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.direction = 'down';
      this.moveToNextWhite(row, col, 1, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.direction = 'down';
      this.moveToNextWhite(row, col, -1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.moveToNextWord(e.shiftKey ? -1 : 1);
    } else if (e.key === ' ') {
      e.preventDefault();
      this.direction = (this.direction === 'across') ? 'down' : 'across';
      this.updateHighlights();
      Clues.syncFromGrid(this.selectedCell, this.direction);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      App.pushUndo();
      if (cells[idx].letter) {
        cells[idx].letter = '';
      } else {
        var dr = (this.direction === 'down') ? -1 : 0;
        var dc = (this.direction === 'across') ? -1 : 0;
        this.moveToNextWhite(row, col, dr, dc);
        if (this.selectedCell !== idx) {
          cells[this.selectedCell].letter = '';
        }
      }
      App.onCellEdit();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      App.pushUndo();
      cells[idx].letter = '';
      App.onCellEdit();
    } else if (e.key === 'Escape') {
      this.selectedCell = null;
      this.updateHighlights();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      App.pushUndo();
      cells[idx].letter = e.key.toUpperCase();
      var dr2 = (this.direction === 'down') ? 1 : 0;
      var dc2 = (this.direction === 'across') ? 1 : 0;
      this.moveToNextWhite(row, col, dr2, dc2);
      App.onCellEdit();
    }
  },

  moveToNextWhite: function(row, col, dr, dc) {
    var puzzle = App.puzzle;
    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;
    var r = row + dr;
    var c = col + dc;
    if (r >= 0 && r < height && c >= 0 && c < width && !cells[r * width + c].black) {
      this.selectedCell = r * width + c;
    }
    this.updateHighlights();
    Clues.syncFromGrid(this.selectedCell, this.direction);
  },

  moveToNextWord: function(dir) {
    var puzzle = App.puzzle;
    var slots = Numbering.getSlots(puzzle);
    if (!slots.length) return;

    var currentSlot = this.getCurrentSlot();
    var currentIdx = -1;
    if (currentSlot) {
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].number === currentSlot.number && slots[i].direction === currentSlot.direction) {
          currentIdx = i;
          break;
        }
      }
    }

    var nextIdx = (currentIdx + dir + slots.length) % slots.length;
    var next = slots[nextIdx];
    this.direction = next.direction;
    this.selectedCell = next.cells[0];
    this.updateHighlights();
    Clues.syncFromGrid(this.selectedCell, this.direction);
  },

  getCurrentSlot: function() {
    if (this.selectedCell === null) return null;
    var puzzle = App.puzzle;
    var slots = Numbering.getSlots(puzzle);
    var self = this;
    var match = null;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].direction === self.direction && slots[i].cells.indexOf(self.selectedCell) !== -1) {
        return slots[i];
      }
    }
    for (var j = 0; j < slots.length; j++) {
      if (slots[j].cells.indexOf(self.selectedCell) !== -1) {
        return slots[j];
      }
    }
    return null;
  },

  updateHighlights: function() {
    var gridEl = document.getElementById('grid');
    if (!gridEl) return;
    var cellEls = gridEl.querySelectorAll('.cell');
    for (var i = 0; i < cellEls.length; i++) {
      cellEls[i].classList.remove('selected', 'active-word');
    }

    if (this.selectedCell === null) return;

    var selEl = gridEl.querySelector('[data-index="' + this.selectedCell + '"]');
    if (selEl) selEl.classList.add('selected');

    var slot = this.getCurrentSlot();
    if (slot) {
      for (var j = 0; j < slot.cells.length; j++) {
        var ce = gridEl.querySelector('[data-index="' + slot.cells[j] + '"]');
        if (ce) ce.classList.add('active-word');
      }
    }
  },

  selectCellForClue: function(number, direction) {
    var puzzle = App.puzzle;
    var slots = Numbering.getSlots(puzzle);
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].number === number && slots[i].direction === direction) {
        this.direction = direction;
        this.selectedCell = slots[i].cells[0];
        this.updateHighlights();
        return;
      }
    }
  }
};
