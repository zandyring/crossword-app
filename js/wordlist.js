// Word list loader and pattern matcher
var WordList = {
  words: [],
  byLength: {},
  loaded: false,

  load: function() {
    var self = this;
    return fetch('data/wordlist.txt?v=2').then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.text();
    }).then(function(text) {
      self.words = text.trim().split('\n');
      var cleaned = [];
      for (var i = 0; i < self.words.length; i++) {
        var w = self.words[i].trim().toUpperCase();
        if (/^[A-Z]{3,21}$/.test(w)) cleaned.push(w);
      }
      self.words = cleaned;
      self.byLength = {};
      for (var j = 0; j < self.words.length; j++) {
        var len = self.words[j].length;
        if (!self.byLength[len]) self.byLength[len] = [];
        self.byLength[len].push(self.words[j]);
      }
      self.loaded = true;
      console.log('WordList loaded: ' + self.words.length + ' words');
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
  }
};
