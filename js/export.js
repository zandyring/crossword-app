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
