var Cue = require("./cue.js").Cue;
var Sound = require("./sound.js").Sound;

var Pitch = exports.Pitch = function(args) {
    if (!args) {
        args = {};
    } else if (typeof args === "string") {
        args = JSON.parse(args);
    }

    Cue.call(this, args);
    this.parent = 'parent' in args ? args.parent : null;
    this.values = 'values' in args ? args.values : {}; //default, for transport
    this.descriptions = 'descriptions' in args ? args.descriptions : {};
    this.octaves = 'octaves' in args ? args.octaves : {};
};

Pitch.prototype = new Cue();
Pitch.prototype.constructor = Pitch;

Pitch.FLAG_SHARED = 1 << 0; //can only be change by source
Pitch.FLAG_IN = 1 << 1; //handler
Pitch.FLAG_OUT = 1 << 2; //emiter
Pitch.FLAG_VALUE = 1 << 3; //static value
Pitch.FLAG_ARGUMENT = 1 << 4; //value is a uri to an argument
Pitch.FLAG_DUET = 1 << 5; //value is a uri to an argument
Pitch.FLAG_AUTO = 1 << 6; //value is a uri to an argument

Pitch.prototype.key = function() {
    if (!this.parent) {
        throw new Error("No parent");
    }
    return this.parent + "/pitches/" + this.id;
}

Pitch.prototype.setOctave = function(octave, flags) {
    if (octave === "pitch") {
        throw new Error("illegal octave key");
    }
    var ops = [];
    if (flags !== null && (!(octave in this.octaves) || this.octaves[octave] !== flags)) {
        this.octaves[octave] = flags;
        ops.push({
            p: ["pitches", this.id, "octaves", octave],
            oi: flags
        });
    }
    return ops;
};

Pitch.prototype.updateOctave = function(octave, flags) {
    return this.setOctave(octave, this.getOctaveFlags(octave) | flags);
};

Pitch.prototype.setValue = function(octave, value, shared) {
    var ops = [];
    if (value !== null && (!(octave in this.values) || this.values[octave] !== value)) {
        this.values[octave] = value;
        ops.push({
            p: ["pitches", this.id, "value", octave],
            oi: value
        });
    }
    var flags = this.getOctaveFlags(octave) | Pitch.FLAG_VALUE;
    if(shared){
        flags |= Pitch.FLAG_SHARED;
    }
    ops.push(this.setOctave(octave, flags));
    return ops;
};

Pitch.prototype.linkArgument = function(octave, argumentKey) {
    if(!argumentKey){
        throw new Error("Illegal argument key");
    }
    if(!this.parent){
        throw new Error("Can't link argument when pitch doesn't have a parent");
    }
    var ops = [];
    var argumentURI = this.parent +"/arguments/" + argumentKey;
    if ((!(octave in this.values) || this.values[octave] !== argumentURI)) {
        this.values[octave] = argumentURI;
        ops.push({
            p: ["pitches", this.id, "value", octave],
            oi: argumentURI
        });
    }
    ops.push(this.setOctave(octave, this.getOctaveFlags(octave)| Pitch.FLAG_VALUE));
    return ops;
};


Pitch.prototype.setIn = function(octave, value) {
    var ops = [];
    if (value === null || value === false) {
        if (octave in this.octaves) {
            ops = this.setOctave(octave, this.getOctaveFlags(octave) ^ Pitch.FLAG_IN);
        }
    } else {
         ops = this.setOctave(octave, this.getOctaveFlags(octave) | Pitch.FLAG_IN);
    }
    return ops;
};

Pitch.prototype.setOut = function(octave, value) {
    var ops = [];
    if (value === null || value === false) {
        if (octave in this.octaves) {
            ops = this.setOctave(octave, this.getOctaveFlags(octave) ^ Pitch.FLAG_OUT);
        }
    } else {
            ops = this.setOctave(octave, this.getOctaveFlags(octave)| Pitch.FLAG_OUT);
    }
    return ops;
};

Pitch.prototype.setDescription = function(octave, value) {
    var ops = [];
    if (value !== null && (!(octave in this.descriptions) || this.descriptions[octave] !== value)) {
        this.descriptions[octave] = value;
        ops.push({
            p: ["pitches", this.id, "descriptions", octave],
            oi: value
        });
    }
    return ops;
};

Pitch.prototype.getOctaveFlags = function(octave) {
    if (octave === "pitch") { //implied
        return Pitch.FLAG_VALUE;
    } else if (octave in this.octaves) {
        return this.octaves[octave];
    }
    return 0;
}

Pitch.prototype.getValue = function(octave, client) {
    if (octave === "pitch") {
        return this;
    } else if (octave in this.values) {
        var value = this.values[octave];
        if ((this.octaves[octave] & Pitch.FLAG_ARGUMENT) === Pitch.FLAG_ARGUMENT) {
            if (!client) {
                throw new Error("requested argument value without providing client argument");
            }
            if (this.parent in client.harmonizedChords) {
                value = client.harmonizedChords[this.parent].arguments[value];
            }
        } else {
            return value;
        }
    }
}

Pitch.prototype.call = function(client, octave, args, response){
    client.call(this.key() + "/ins/" + octave, args, response);
};

var Action = function(run, description){
    this.run = run;
    this.description = description;
};
Pitch.prototype.getActions = function(target, filter) {
    if(!target){
        throw new Error("invalid target pitch");
    }
    var results = [];
    for(var octave in this.octaves){
        if(octave in target.octaves){
            var sourceFlags = this.octaves[octave];
            var sOut = (sourceFlags & Pitch.FLAG_OUT) === Pitch.FLAG_OUT;
            var sIn = (sourceFlags & Pitch.FLAG_IN) === Pitch.FLAG_IN;
            var sValue = (sourceFlags & Pitch.FLAG_VALUE) === Pitch.FLAG_VALUE;
            var sShared = (sourceFlags & Pitch.FLAG_SHARED) === Pitch.FLAG_SHARED;

            var targetFlags = target.octaves[octave];
            var tOut = (targetFlags & Pitch.FLAG_OUT) === Pitch.FLAG_OUT;
            var tIn = (targetFlags & Pitch.FLAG_IN) === Pitch.FLAG_IN;
            var tValue = (targetFlags & Pitch.FLAG_VALUE) === Pitch.FLAG_VALUE;
            var tShared = (targetFlags & Pitch.FLAG_SHARED) === Pitch.FLAG_SHARED;

            if(sOut && tIn){
                results.push(new Action(function(){}, "Out to In"));
            }
            if(sValue && tIn){
                results.push(new Action(function(){}, this.id + " to " + target.id));
            }
            if(sValue && tValue && tShared){
                results.push(new Action(function(){}, "sync"));
            }

            if(tOut && sIn){
                results.push(new Action(function(){}, target.id + " to " + this.id));
            }
            if(tValue && sIn){
                results.push(new Action(function(){}, "Do a thing"));
            }
            if(tValue && sValue && sShared){
                results.push(new Action(function(){}, "Do a thing"));
            }
            return results;
        }
    }
};

//TODO:remove (Debugging) 
if (require.main === module) {
    var c = new Pitch();
    c.setValue("cat", "meow");
    // c.linkArgument("cat", "nasty");
    c.setOut("cat");
    ops = c.setIn("cat");
    console.log(c, ops);
}
