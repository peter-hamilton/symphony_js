var Cue = require("./cue.js").Cue;

var Pitch = exports.Pitch = function(args) {
    if (!args) {
        args = {};
    } else if (typeof args === "string") {
        args = JSON.parse(args);
    }
    Cue.call(this, args);

    this.action = 'action' in args ? args.action : null;
    this.parent = 'parent' in args ? args.parent : null;
};

Pitch.prototype = new Cue();
Pitch.prototype.constructor = Pitch;

Pitch.prototype.key = function() {
    if (!this.parent) {
        throw new Error("No parent");
    }
    return this.parent + "/pitches/" + this.action + "/" + this.type;
}

//TODO:remove (Debugging) 
if (require.main === module) {
    var c = new Pitch({type:"asd",action:"asdasd"});
    console.log(c);
}