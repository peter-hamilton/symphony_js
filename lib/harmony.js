var Cue = require("./cue.js").Cue;
var Chord = require("./chord.js").Chord;

var Harmony = exports.Harmony = function(args) {
    args = typeof args !== "undefined" && args ? args : {};
    Cue.call(this, args);
    this.type = "harmony";
    this.parent = 'parent' in args ? args.parent : null;
    this.active = 'active' in args ? args.active : true;
    this.sourceChord = 'sourceChord' in args ? args.sourceChord : null;
    this.targetChord = 'targetChord' in args ? args.targetChord : null;
    this.classes = 'classes' in args ? args.classes : {}; //{class name : flags, ...}
};

Harmony.prototype = new Cue();
Harmony.prototype.constructor = Harmony;

Harmony.prototype.setSource = function(cId) {
    var ops = [];
    if (cId !== null && this.sourceChord !== cId) {
        this.sourceChord = cId;
        ops.push({
            p: ["harmonies", this.id, "sourceChord"],
            oi: cId
        });
    }
    return ops;
};

Harmony.prototype.setTarget = function(cId) {
    var ops = [];
    if (cId !== null && this.targetChord !== cId) {
        this.targetChord = cId;
        ops.push({
            p: ["harmonies", this.id, "targetChord"],
            oi: cId
        });
    }
    return ops;
};

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
