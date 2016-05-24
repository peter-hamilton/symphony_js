var Cue = require("./cue.js").Cue;

var Interval = exports.Interval = function(args) {
	Cue.call(this, args);
	this.pitch1 = 
};

Interval.prototype = new Cue();
Interval.prototype.constructor = Interval;

//TODO:remove (Debugging) 
if (require.main === module) {
  var x = new Interval();
  console.log(x);
  // throw "done";
}