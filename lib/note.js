var Cue = require("./cue.js").Cue;

var Note = exports.Note = function(args) {
    if (!args) {
        args = {};
    } else if (typeof args === "string") {
        args = JSON.parse(args);
    }
    Cue.call(this, args);

    this.action = 'action' in args ? args.action : null;
    this.parent = 'parent' in args ? args.parent : null;
};

Note.prototype = new Cue();
Note.prototype.constructor = Note;


//TODO:remove (Debugging) 
if (require.main === module) {
    var c = new Note({type:"asd",action:"asdasd"});
    console.log(c);
}