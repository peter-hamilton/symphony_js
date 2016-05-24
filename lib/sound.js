var Cue = require("./cue.js").Cue;

var Sound = exports.Sound = function(args) {

        if(!args){
        args = {};
    }else if(typeof args === "string"){
        args = JSON.parse(args);
    }

    var callable = args['callable'];
    if (typeof callable === "undefined") {

        throw new Error("Invalid argument");
    } else if (typeof callable !== "function") {
        //create function that returns static value
        var staticResult = callable;
        callable = function(arguments) {
            return staticResult;
        }
    }

    args.type = "sound";
    Cue.call(this, args);

    this.callable = callable;
    // this.callable.__proto__ = Sound.prototype
};
Sound.prototype = new Cue();
Sound.prototype.constructor = Sound;



// Sound.prototype.toString = function() {
//     return new Cue(this).toString();
// }


Sound.prototype.toJSON = function() {
    return new Cue(this).toJson();
}

Sound.fromHandler = function(handler){
	return new Sound({'callable':handler});
}

//TODO:remove (Debugging) 
if (require.main === module) {
    var s = new Sound(Sound.fromHandler(function() {
        return "dog"; }));
    var c = JSON.stringify({ cat: "cat", dog: function() {} });
    console.log(c);
    console.log(s);
    console.log(s.callable());
}
