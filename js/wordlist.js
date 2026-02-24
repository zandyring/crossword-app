// Word list loader and pattern matcher
var WordList = {
  words: [],
  scores: {},
  byLength: {},
  loaded: false,

  load: function() {
    var self = this;
    return fetch('data/wordlist.txt?v=3').then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    }).then(function(text) {
      var lines = text.trim().split('\n');
      var cleaned = [];
      self.scores = {};
      for (var i = 0; i < lines.length; i++) {
        var parts = lines[i].trim().split('\t');
        var w = parts[0].toUpperCase();
        var score = parts.length > 1 ? parseInt(parts[1], 10) : 50;
        if (/^[A-Z]{3,21}$/.test(w)) {
          cleaned.push(w);
          self.scores[w] = score;
        }
      }
      // Sort by score descending so highest-quality words come first
      cleaned.sort(function(a, b) {
        return (self.scores[b] || 0) - (self.scores[a] || 0);
      });
      self.words = cleaned;
      self.byLength = {};
      for (var j = 0; j < self.words.length; j++) {
        var len = self.words[j].length;
        if (!self.byLength[len]) self.byLength[len] = [];
        self.byLength[len].push(self.words[j]);
      }
      self.loaded = true;
      console.log('WordList loaded: ' + self.words.length + ' words (scored)');
    }).catch(function(e) {
      console.warn('Word list load failed (expected on file:// protocol):', e.message);
      console.warn('Auto-fill unavailable. Serve via HTTP for full functionality.');
    });
  },

  findMatches: function(pattern) {
    var len = pattern.length;
    var candidates = this.byLength[len] || [];
    var regex = new RegExp('^' + pattern.replace(/_/g, '[A-Z]') + '$');
    var results = [];
    for (var i = 0; i < candidates.length; i++) {
      if (regex.test(candidates[i])) results.push(candidates[i]);
    }
    return results;
  },

  getWordsArray: function() {
    return this.words;
  },

  getScoresArray: function() {
    var arr = [];
    for (var i = 0; i < this.words.length; i++) {
      arr.push(this.scores[this.words[i]] || 50);
    }
    return arr;
  }
};
