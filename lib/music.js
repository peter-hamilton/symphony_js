var Note = require("./note.js").Note;

var Music = exports.Music = function(args) {
	if (!args) {
		this.melodies = {};
		this.chords = {};
		this.tones = {};
		this.notes = {};
	} else {
		//reconstruct
	}
};

Music.prototype.addMelody = function(melody) {
	this.melodies[melody.id] = melody;
};


Music.prototype.addTone = function(tone) {
	this.tones[tone.id] = tone;
};

Music.prototype.addStaticTone = function(tone) {
	this.tones[tone.id] = tone;
	this.notes[tone.id] = new Note(tone);
};

Music.prototype.addNote = function(note) {
	this.notes[note.id] = note;
};


Music.prototype.addChord = function(chord) {
	this.chords[chord.id] = chord;
	for (var nId in this.chords) {
		var note = this.chords[nId];
		if (note) {

			//something
		} else {
			console.log("invalid chord note id: " + nId);
		}
	}
};

Music.prototype.exportCurrent = function(fileName, filter) {
	var fs = require('fs');
	var content = JSON.stringify(this);
	fs.writeFile(fileName, content, function(err) {
		if (err) {
			return console.log(err);
		}

		console.log("saved to " + fileName);
	});
};

Music.fromJson = function(json) {
	var args = JSON.parse(json);
	return new Music(args);
};

//TODO:remove (Debugging) 
if (require.main === module) {
	var m = new Music();
	console.log(m);
}