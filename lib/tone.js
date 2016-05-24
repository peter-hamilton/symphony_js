var Cue = require("./cue.js").Cue;
var Sound = require("./sound.js").Sound;
var Chord = require("./chord.js").Chord;
var Pitch = require("./pitch.js").Pitch;
var Harmony = require("./harmony.js").Harmony;

var Tone = exports.Tone = function(args) {
    if (!args) {
        args = {};
    } else if (typeof args === "string") {
        args = JSON.parse(args);
    }

    Cue.call(this, args);
    this.launch = 'launch' in args ? args.launch : null;
    this.harmonies = "harmonies" in args ? args.harmonies : {};
    this.chords = 'chords' in args ? args.chords : {};
    this.pitches = "pitches" in args ? args.pitches : {};
    this.intervals = "intervals" in args ? args.intervals : {};
    this.pendingActions = "pendingActions" in args ? args.pendingActions : {};

    
};

Tone.prototype = new Cue();
Tone.prototype.constructor = Tone;


Tone.prototype.addChord = function(chordId, chordId) {
    var ops = [];
    chordId = chordId || this.id;

    ops.push({
        p: ["chords", chordId],
        oi: chordId
    });
    return ops;
}

Tone.prototype.removeChord = function(chordId) {
    var ops = [];
    if (chordId in this.chords) {
        ops.push({
            p: ["chords", chordId],
            od: chordId
        });
    }
    return ops;
}

Tone.prototype.addChord = function(music, chord) {
    chord.toneId = this.id;
    music.addChord(chord);
    if (!(chord.id in this.chords))
        this.chords.push(chord.id);
};

Tone.prototype.setChords = function(music, chordList) {
    for (var nId in chordList) {
        n = chordList[nId];
        n.toneId = this.id;
        music.addChord(n);
        if (!(nId in this.chords))
            this.chords[nId] = null;
    }
};

Tone.prototype.addHarmony = function(id) {
    if (!id || id === this.id)
        throw ("invalid target id");
    var ops = [];
    var harmony = new Harmony({ 'id': id, 'parent': this.id });
    this.harmonies[harmony.id] = harmony;
    ops.push({ "p": ["harmonies", harmony.id], oi: harmony });
    return ops;
};


Tone.prototype.removeHarmony = function(id) {
    if (!id)
        throw new Error("null id");
    var ops = [];
    if (id in this.harmonies) {
        var harmony = this.harmonies[id];
        delete this.harmonies[harmony.id];
        ops.push({ "p": ["harmonies", harmony.id], od: harmony });
    }
    return ops;
};

Tone.prototype.addPitch = function(pitch, states) {
    if (!pitch || !pitch.id)
        throw ("invalid pitch");
    var ops = [];
    this.pitches[pitch.id] = pitch;
    ops.push({ "p": ["pitches", pitch.id], oi: pitch });
    if (states && states instanceof Array) {}
    return ops;
};

Tone.prototype.removePitch = function(id) {
    if (!id)
        throw new Error("null id");
    var ops = [];
    if (id in this.pitches) {
        var pitch = this.pitches[id];
        delete this.pitches[pitch.id];
        ops.push({ "p": ["pitches", pitch.id], od: pitch });
    }

    return ops;
};

Tone.prototype.putRegisteredArgument = function(id, value, octave, pitchParams, shared) {
    var ops = [];
    pitchParams = pitchParams || {};
    pitchParams.id = id;
    pitchParams.parent = this.id;
    var pitch = new Pitch(pitchParams);
    // pitch.linkArgument(octave, id);

    // if (shared) {
    //     pitch.updateOctave(octave, Pitch.FLAG_SHARED);
    // }
    ops.concat(this.putArgument(id, value));
    ops.concat(this.addPitch(pitch));
    return ops;
}


Tone.prototype.register = function(params, states) {
    if (!params) throw new Error("invalid params");
    if (params.parent === undefined) {
        params.parent = this.id;
    }
    var pitch = new Pitch(params);
    return this.addPitch(pitch);
};

Tone.prototype.unregister = function(id) {
    return this.removePitch(id);
};

Tone.prototype.createInterval = function(localPitch, remotePitch) {

    if (!(localPitch.id in this.pitches)) {
        throw ("Illegal Interval. Client can't create intervals between external pitches.");
    }
    var ops = [];
    var interval = 0;
    var key = remotePitch.key();
    var local = localPitch.id;
    if (localPitch.hasFlags(Pitch.FLAG_IN) && remotePitch.hasFlags(Pitch.FLAG_OUT)) {
        interval |= Pitch.FLAG_OUT;
    }
    if (remotePitch.hasFlags(Pitch.FLAG_IN) && localPitch.hasFlags(Pitch.FLAG_OUT)) {
        interval |= Pitch.FLAG_IN;
    }
    if (remotePitch.hasFlags(Pitch.FLAG_ARGUMENT)) {
        interval |= Pitch.FLAG_ARGUMENT;
    }

    if (!(key in this.intervals)) {
        this.intervals[key] = {};
        this.intervals[key][local] = interval;
        ops.push({ 'p': ['intervals', key], 'oi': this.intervals[key] });
    } else {
        this.intervals[key][local] = interval;
        ops.push({ 'p': ['intervals', key, local], 'oi': interval });
    }
    if (!(local in this.intervals)) {
        this.intervals[local] = {};
        this.intervals[local][key] = interval;
        ops.push({ 'p': ['intervals', local], 'oi': this.intervals[local] });
    } else {
        this.intervals[local][key] = interval;
        ops.push({ 'p': ['intervals', local, key], 'oi': interval });
    }
    return ops;
};

Tone.prototype.removeInterval = function(pitchA, pitchB) {
    var ops = [];
    var keyA = pitchA.key();
    var keyB = pitchB.key();
    if (this.hasInterval) {
        var interval = this.intervals[keyA][keyB];
        delete this.intervals[keyA][keyB];
        delete this.intervals[keyB][keyA];
        ops.push({ 'p': ['intervals', keyA, keyB], 'od': interval });
        ops.push({ 'p': ['intervals', keyB, keyA], 'od': interval });
    }
    return ops;
};

Tone.prototype.getIntervals = function(pitch) {
    var result;
    var key = pitch.key();
    if (key in this.intervals) {
        var targets = this.intervals[key];
        if (targets) {
            result = Object.keys(targets);
        }
    }
    return result;
}

Tone.prototype.hasInterval = function(pitchA, pitchB) {
    return pitchA.key() in this.intervals && pitchB.key() in this.intervals[pitchA.key()];
};

Tone.prototype.generateChord = function(targetId) {
    if (!targetId || !(targetId in this.harmonies)) {
        throw ("invalid chord generation params");
    }
    var chord = new Chord(this);
    chord.id = Cue.createUUID();
    chord.parent = this.id;
    chord.target = targetId;
    return chord; 
}

//TODO:remove (Debugging) 
if (require.main === module) {
    var c = new Tone();


    var a = new Pitch({ parent: 'a' });
    c.addPitch(a);
    var b = new Pitch({ parent: 'a' });
    console.log(c.createInterval(a, b));
    console.log(c);
    console.log(c.hasInterval(a, b));
    console.log(c.removeInterval(a, b));
    console.log(c.hasInterval(a, b));
}
