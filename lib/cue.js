var deepDiffMapper = require("./deepDiffMapper.js");

var Cue = exports.Cue = function(args) {
    if (!args) {
        args = {};
    } else if (typeof args === "string") {
        args = JSON.parse(args);
    }

    this.type = 'type' in args ? args.type : null;
    this.id = 'id' in args ? args.id : Cue.createUUID();
    this.flags = "flags" in args ? args.flags : 0;
    this.arguments = 'arguments' in args ? args.arguments : {};
};


Cue.prototype.toJson = function() {
    return JSON.stringify(this);
};

Cue.prototype.toBytes = function() {

};

Cue.fromJson = function(jsonCue) {
    var args = JSON.parse(jsonCue);
    return new Cue(args);
};

Cue.fromBytes = function(bytesCue) {

};

Cue.prototype.putArgument = function(key, value) {
    //TODO: check valid
    var ops = [];
    if (!(key in this.arguments) || (this.arguments[key] !== value)) {
        this.arguments[key] = value;
        ops.push({
            p: ["arguments", key],
            oi: value
        });
    }
    return ops;
};
Cue.prototype.putArguments = function(args) {
    //TODO: check valid
    var ops = [];
    for (var k in args) {
        var op = this.putArgument(k, args[k]);
        if (op) {
            ops = ops.concat(op);
        }
    }
    return ops;
};


Cue.prototype.setFlags = function(flags) {
    ops = [];
    if (this.flags ^ flags !== 0) {
        this.flags = this.flags | flags;
        ops.push({
            p: ["flags"],
            oi: this.flags
        });
    }
    return ops;
};

Cue.prototype.unsetFlags = function(flags) {
    ops = [];
    if (this.flags & flags > 0) {
        this.flags = this.flags ^ flags;
        ops.push({
            p: ["flags"],
            oi: this.flags
        });
    }
    return ops;
};

Cue.prototype.hasFlags = function(flags) {
    return (this.flags & flags) === flags;
};

Cue.prototype.diff = function(data, path, ignore) {
    if (!data) {
        throw ("invalid data value " + data);
    }
    path = path || [];
    return deepDiffMapper.map(path, this, data, ignore);
};

Cue.createUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        // return v.toString(16);
        return v.toString(16);
    }).slice(0, 8); //TODO: return to scalable size
}

Cue.prependPath = function(pre, ops){
    if(ops){
        for(var i=0; i < ops.length ; i++){
            ops.unshift(pre);
        }
    }

}

//TODO:remove (Debugging) 
if (require.main === module) {
    var c = new Cue();
    var c2 = new Cue();
    c2.putArgument("a", "b");
    console.log(c.diff(c2, null, ["arguments"]));
}
