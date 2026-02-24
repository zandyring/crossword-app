// Clue editor panel with bidirectional sync
var Clues = {
  render: function(puzzle) {
    var slots = Numbering.getSlots(puzzle);
    var acrossEl = document.getElementById('clues-across');
    var downEl = document.getElementById('clues-down');
    if (!acrossEl || !downEl) return;
    acrossEl.innerHTML = '';
    downEl.innerHTML = '';

    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s];
      var container = (slot.direction === 'across') ? acrossEl : downEl;

      var answer = '';
      for (var ci = 0; ci < slot.cells.length; ci++) {
        answer += puzzle.cells[slot.cells[ci]].letter || '_';
      }

      var clueText = '';
      if (puzzle.clues[slot.direction] && puzzle.clues[slot.direction][slot.number]) {
        clueText = puzzle.clues[slot.direction][slot.number];
      }

      var entry = document.createElement('div');
      entry.className = 'clue-entry';
      entry.setAttribute('data-direction', slot.direction);
      entry.setAttribute('data-number', slot.number);

      var numSpan = document.createElement('span');
      numSpan.className = 'clue-number';
      numSpan.textContent = slot.number;
      entry.appendChild(numSpan);

      var input = document.createElement('input');
      input.className = 'clue-input';
      input.type = 'text';
      input.value = clueText;
      input.placeholder = 'Enter clue...';

      (function(slotRef) {
        input.addEventListener('input', function(e) {
          var p = App.puzzle;
          if (!p.clues[slotRef.direction]) p.clues[slotRef.direction] = {};
          p.clues[slotRef.direction][slotRef.number] = e.target.value;
          App.autoSave();
        });
        input.addEventListener('focus', function() {
          Grid.selectCellForClue(slotRef.number, slotRef.direction);
          Clues.highlightClue(slotRef.number, slotRef.direction);
        });
      })(slot);

      entry.appendChild(input);

      var answerSpan = document.createElement('span');
      answerSpan.className = 'clue-answer';
      answerSpan.textContent = answer;
      entry.appendChild(answerSpan);

      (function(slotRef) {
        entry.addEventListener('click', function(e) {
          if (e.target.tagName !== 'INPUT') {
            Grid.selectCellForClue(slotRef.number, slotRef.direction);
            Clues.highlightClue(slotRef.number, slotRef.direction);
          }
        });
      })(slot);

      container.appendChild(entry);
    }
  },

  highlightClue: function(number, direction) {
    var entries = document.querySelectorAll('.clue-entry');
    for (var i = 0; i < entries.length; i++) {
      entries[i].classList.remove('active');
    }
    var entry = document.querySelector('.clue-entry[data-number="' + number + '"][data-direction="' + direction + '"]');
    if (entry) {
      entry.classList.add('active');
      entry.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },

  syncFromGrid: function(cellIndex, direction) {
    if (cellIndex === null) {
      var entries = document.querySelectorAll('.clue-entry');
      for (var i = 0; i < entries.length; i++) {
        entries[i].classList.remove('active');
      }
      return;
    }

    var puzzle = App.puzzle;
    var slots = Numbering.getSlots(puzzle);
    var slot = null;

    // Try to find a slot matching the direction first
    for (var j = 0; j < slots.length; j++) {
      if (slots[j].direction === direction && slots[j].cells.indexOf(cellIndex) !== -1) {
        slot = slots[j];
        break;
      }
    }
    // Fallback to any slot containing this cell
    if (!slot) {
      for (var k = 0; k < slots.length; k++) {
        if (slots[k].cells.indexOf(cellIndex) !== -1) {
          slot = slots[k];
          break;
        }
      }
    }

    if (slot) {
      this.highlightClue(slot.number, slot.direction);
    }
  },

  updateAnswers: function(puzzle) {
    var slots = Numbering.getSlots(puzzle);
    for (var s = 0; s < slots.length; s++) {
      var slot = slots[s];
      var entry = document.querySelector('.clue-entry[data-number="' + slot.number + '"][data-direction="' + slot.direction + '"]');
      if (entry) {
        var answerEl = entry.querySelector('.clue-answer');
        if (answerEl) {
          var answer = '';
          for (var ci = 0; ci < slot.cells.length; ci++) {
            answer += puzzle.cells[slot.cells[ci]].letter || '_';
          }
          answerEl.textContent = answer;
        }
      }
    }
  }
};
