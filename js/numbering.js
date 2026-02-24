// Crossword numbering algorithm and slot extraction
var Numbering = {
  compute: function(puzzle) {
    var width = puzzle.width;
    var height = puzzle.height;
    var cells = puzzle.cells;

    function isBlack(r, c) {
      return r < 0 || r >= height || c < 0 || c >= width || cells[r * width + c].black;
    }

    var num = 0;
    var slots = { across: [], down: [] };

    for (var r = 0; r < height; r++) {
      for (var c = 0; c < width; c++) {
        var idx = r * width + c;
        if (cells[idx].black) {
          cells[idx].number = null;
          continue;
        }

        var startsAcross = false;
        var startsDown = false;

        // Starts across: left is black/edge, and at least 3 cells to the right
        if (isBlack(r, c - 1)) {
          var alen = 0;
          for (var cc = c; cc < width && !cells[r * width + cc].black; cc++) alen++;
          if (alen >= 3) startsAcross = true;
        }

        // Starts down: top is black/edge, and at least 3 cells below
        if (isBlack(r - 1, c)) {
          var dlen = 0;
          for (var rr = r; rr < height && !cells[rr * width + c].black; rr++) dlen++;
          if (dlen >= 3) startsDown = true;
        }

        if (startsAcross || startsDown) {
          num++;
          cells[idx].number = num;

          if (startsAcross) {
            var al = 0;
            for (var ac = c; ac < width && !cells[r * width + ac].black; ac++) al++;
            slots.across.push({ number: num, row: r, col: c, length: al });
          }
          if (startsDown) {
            var dl = 0;
            for (var dr = r; dr < height && !cells[dr * width + c].black; dr++) dl++;
            slots.down.push({ number: num, row: r, col: c, length: dl });
          }
        } else {
          cells[idx].number = null;
        }
      }
    }

    return slots;
  },

  getSlots: function(puzzle) {
    var width = puzzle.width;
    var rawSlots = this.compute(puzzle);
    var result = [];

    for (var a = 0; a < rawSlots.across.length; a++) {
      var s = rawSlots.across[a];
      var cellIndices = [];
      for (var i = 0; i < s.length; i++) cellIndices.push(s.row * width + (s.col + i));
      result.push({ number: s.number, row: s.row, col: s.col, length: s.length, direction: 'across', cells: cellIndices });
    }
    for (var d = 0; d < rawSlots.down.length; d++) {
      var sd = rawSlots.down[d];
      var dCells = [];
      for (var j = 0; j < sd.length; j++) dCells.push((sd.row + j) * width + sd.col);
      result.push({ number: sd.number, row: sd.row, col: sd.col, length: sd.length, direction: 'down', cells: dCells });
    }

    return result;
  }
};
