var Cue = require("./cue.js").Cue;
var Pitch = require("./pitch.js").Pitch;

var Chord = exports.Chord = function(args) {
    args = typeof args !== "undefined" && args ? args : {};
    Cue.call(this, args);
    this.parent = 'parent' in args ? args.parent : null;
    this.target = 'target' in args ? args.target : null;
    this.pitches = 'pitches' in args ? args.pitches : {};
};

Chord.prototype = new Cue();
Chord.prototype.constructor = Chord;


//used to order interval ids
var hashString = function(input) {
    var hash = 0,
        i, chr, len;
    if (input.length === 0) return hash;
    for (i = 0, len = input.length; i < len; i++) {
        chr = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

//TODO:remove (Debugging) 
if (require.main === module) {

}
