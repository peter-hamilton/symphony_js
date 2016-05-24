var Cue = exports.Cue = require('../cue.js').Cue;
var Tone = exports.Tone = require('../tone.js').Tone;
var Note = exports.Note = require('../note.js').Note;
var Pitch = exports.Pitch = require('../pitch.js').Pitch;
var Chord = exports.Chord = require('../chord.js').Chord;
var Sound = exports.Sound = require('../sound.js').Sound;
var Harmony = exports.Harmony = require("../harmony.js").Harmony;

//hack
var Connection = require('../../node_modules/sharedb/lib/client/connection');

// var templates = exports.templates = require('../templates.js');

var events = require('events');

var slick = require('slick');

var Symphony = exports.client = function(params, callback) {
    var self = this;

    params = params ? params : {};
    self.onInitCallback = callback;

    if (!params.host) {
        throw new Error("invalid host");
    }
    this.host = params.host;

    this.socketModule = params.socketModule;
    if (!this.socketModule) {
        if (exports.defaultSocketModule) {
            this.socketModule = exports.defaultSocketModule;
        } else {
            throw new Error("invalid 'socketModule' param");
        }
    }

    if (!params.deviceId) {
        params.deviceId = Cue.createUUID();
    }
    var deviceId = this.deviceId = params.deviceId;

    this.instanceId = null;

    if (!params.type) {
        params.type = "default";
    }
    this.type = params.type;

    var reset = params.reset ? params.reset : false;

    if (!params.arguments) {
        params.arguments = null;
    }

    // this.watchedArguments = {};
    this.watchedPitches = {};
    this.pitches = {};

    this.toneArguments = params.arguments;

    var cueHandlers = this.cueHandlers = {};

    this.Cue = Cue;


    //Todo: make less sloppy
    this.docCache = {
        'notes': {},
        'chords': {},
        'tones': {}
    };

    this.docListeners = {}; //{id: arrayOfListeners}, void listener(changes, snapshot)

    this.symphonyListeners = {
        'notes': {},
        'chords': {},
        'tones': {}
    };

    this.opListener = null;


    this.pendingHarmonyCallbacks = {};

    this.harmonizedChords = {};
    this.instances = {};

    this.sounds = {}; //Handlers


    var socket = this.socket = this.socketModule(this.host

    );
    socket.readyState = 1;
    socket.canSendWhileConnecting = true;
    socket.onmessage = function() {};
    socket.onerror = function() {};

    socket.on('message', function(data) {
        socket.onmessage(data);
    });
    socket.on('error', function(data) {
        console.log('error: ', data);
        socket.onerror(data);
    });

    socket.on('connect', function(e) {
        self.instanceId = self.getInstanceId();
    });
    socket.on('connect-error', function(e) {
        console.log('connect-error', e);
    });

    var connection = this.connection = new Connection(socket);
    connection.debug = true;

    this.notes = {};
    this.inEventHandlers = {}; //[type][note] =handlers


    var toneDoc = this.toneDoc = this.getDoc('tones', deviceId);
    this.tone = null;
    var toneRegistered = this.toneRegistered = false;
    var onToneUpdate = this.onToneUpdated(toneDoc);
    toneDoc.on('op', onToneUpdate);

    toneDoc.fetch(function() {
        if (!self.toneDoc.type || reset) { //reset
            console.log('creating tone');
            self.tone = new Tone({
                'id': self.deviceId,
                'type': self.type
            });
            if (self.toneArguments) {
                self.tone.putArguments(self.toneArguments);
            }

            self.setDoc("tones", self.tone.id, self.tone, function() {
                self.toneRegistered = true;
                self.setRegistered();
                if (self.onInitCallback) {
                    self.onInitCallback();
                }

            });
        } else { //restore
            console.log('tone already created');
            self.tone = new Tone(self.toneDoc.data);
            onToneUpdate();

            if (self.onInitCallback) {
                self.onInitCallback();
            }
        }

    }.bind(self));



    this.socket.on('cue', function(data) {
        console.log('new cue:');
        console.log(data);
        try {
            // newCue = JSON.parse(data);

            newCue = typeof(data) === 'string' ? new Cue(JSON.parse(data)) : new Cue(data);
        } catch (e) {
            console.log(e.stack);
            console.log("broken cue?", newCue);
        }
        type = newCue.type;
        console.log(type);

        //symphony cues
        if (type && type === "chordEvent") {
            self.handleChordEvent(newCue);
        } else if (type && type in cueHandlers) {
            console.log("handling " + type);
            cueHandlers[newCue.type](newCue);
        } else if (type) {
            console.log("unhandled cue: " + type);
        }
    });

    this.socket.on("chordEvent", this.handleChordEvent.bind(this));

    this.socket.on("routeEvent", this.handleRouteEvent.bind(this));

    this.instanceEventListener = null;

    this.socket.on("instanceEvent", function(data) {
        if (self.instanceEventListener) {
            self.instanceEventListener(data);
        }
    });


    this.socket.emit('setConnectionParams', {
        connectionType: 'browser',
        toneId: self.deviceId
    });
};


Symphony.prototype.setInstanceEventListener = function(listener) {
    if (!listener || typeof listener !== "function") {
        throw new Error("illegal instance event listener: " + listener);
    }
    this.instanceEventListener = listener;
};

Symphony.prototype.on = function(eventType, handler) {
    this.cueHandlers[eventType] = handler;
};

Symphony.prototype.handleChordEvent = function(cue) {
    var self = this;

    if (cue && cue.arguments.eventType) {
        switch (cue.arguments.eventType) {
            case "call":
                self.call(cue.arguments.key, cue.arguments.value, cue.arguments.source)
                break;
        }
    }
};

Symphony.prototype.getInstanceId = function() {
    var result = null;
    if (this.socket && this.socket.instanceId) { //non socketio interfaces
        result = this.socket.instanceId;
    } else if (this.socket && this.socket.io && this.socket.io.engine) {
        result = this.socket.io.engine.id;
    }
    return result;
}


Symphony.prototype.handleRouteEvent = function(data, response) {
    if (data && data.event && data.event.type) {
        switch (data.event.type) {
            case "call":
                this.call(data.key, data.event.value, response, data.event.toneId);
                break;
            case "get":
                var result = this.get(data.key);
                if (response) {
                    response(result);
                }
                break;
        }
    }
}

Symphony.prototype.handleSyncEvent = function(data, response) {
    return this.call(data.key, data.value, response, data.toneId);
}

Symphony.prototype.handleBindEvent = function(data, response) {
    return this.call(data.key, data.value, response, data.toneId);
}


Symphony.prototype.call = function(key, value, response, source) {
    if (key in this.sounds) {
        return this.sounds[key].callable(value, response, source);
    } else if (!source) {
        this.routeEvent("call", key, value, response);
    }
};

Symphony.prototype.get = function(key) {
    if (key && typeof key === "string") {
        var result;
        var path = key.split("/");
        var iId = path[0];
        if (iId in this.harmonizedChords) {
            var chord = this.harmonizedChords[iId];
            result = chord;
            for (var i = 1; i < path.length; i++) {
                var k = path[i];
                if (k in result) {
                    result = result[k];
                    if (typeof result !== "object") {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
        return result;
    }
};


Symphony.prototype.routeEvent = function(type, key, value, response, source) {
    var arguments = {};
    arguments.type = type;
    arguments.key = key;
    arguments.value = value;
    arguments.toneId = this.deviceId;
    arguments.instanceId = this.instanceId;
    this.socket.emit("routeEvent", arguments, response);
};

Symphony.prototype.executePitch = function(pitch, octave, value, source) {
    var key = pitch.key() + "/octaves/" + octave;
    if (pitch.parent === this.deviceId) { //local
        this.execute(key, value, source);
    } else {
        var cue = new Cue();
        cue.type = "chordEvent";
        cue.arguments.key = key;
        cue.arguments.value = value;
        cue.arguments.source = source;
        cue.arguments.toneId = this.deviceId;
        cue.arguments.instanceId = this.instanceId;
        this.broadcastCue(cue);
    }
};


Symphony.prototype.registerOut = function(type, handler, params) {
    if(!params){
        params = {};
    }
    params.action = "out";
    params.type = type;
    params.parent = this.deviceId;
    var pitch = new Pitch(params);
    this.sounds[pitch.key()] = handler;
    return _register(this, pitch);
};

Symphony.prototype.registerIn = function(type, handler, params) {
     if(!params){
        params = {};
    }
    params.action = "in";
    params.type = type;
    params.parent = this.deviceId;
    var pitch = new Pitch(params);
    this.sounds[pitch.key()] = handler;
    return _register(this, pitch);
};

Symphony.prototype.registerValue = function(type, value, params) {
    if(!params){
        params = {};
    }
    params.action = "value";
    params.type = type;
    params.parent = this.deviceId;
    var pitch = new Pitch(params);
    pitch.putArgument("value", value);
    return _register(this, pitch);
};


var _register = function(client, pitch) {
    if (client.toneDoc && client.toneDoc.type) {
        var doc = client.toneDoc;

        var ops = client.tone.register(pitch);
        doc.fetch(function() {
            doc.submitOp(ops, function(e) {
                if (e) console.log(e);
            });
        });
        client.updateChildren(ops);
        client.pitches[pitch.key()] = pitch;
        return pitch;

    } else {
        //add later
    }
}

Symphony.prototype.unregister = function(id) {
    if (this.toneDoc && this.tone) {
        var doc = this.toneDoc;
        var ops = this.tone.unregister(id);
        doc.fetch(function() {
            doc.submitOp(ops, function(e) {
                if (e) console.log(e);
            });
        });
        this.updateChildren(ops);
    } else {
        //add later
    }
};

Symphony.prototype.editPitch = function(action, type) {
    if (this.toneDoc && this.toneDoc.type && id in this.toneDoc.data.pitches) {
        var pitch = this.toneDoc.data.pitches[id];
        pitch.parent = this.deviceId;
        return new Symphony.PitchBuilder(this, pitch);
    }
    return new Symphony.PitchBuilder(this, { 'id': id, 'parent': this.deviceId });
}

var PitchBuilder = Symphony.PitchBuilder = exports.PitchBuilder = function(client, args) {
    if (!args || !args.id) {
        throw new Error("illegal PitchBuilder arguments.")
    }
    this.client = client;
    this.pitch = new Pitch(args);
};

PitchBuilder.prototype.update = function() {
    return _register(this.client, this.pitch);
};

//convenience class
PitchBuilder.prototype.addOctave = function(octave, handler, out, description, value, shared) {
    this.addValue(octave, value, shared);
    this.addIn(octave, handler);
    this.addOut(octave, out);
    this.addDescription(octave, description);
    return this;
};

PitchBuilder.prototype.addIn = function(octave, handler) {
    this.client.sounds[this.pitch.key() + "/ins/" + octave] = Sound.fromHandler(handler);
    this.pitch.setIn(octave);
    return this;
};

PitchBuilder.prototype.addCue = function(octave, type, handler) {
    this.client.sounds[this.pitch.key() + "/cues/" + octave + "/" + type] = Sound.fromHandler(handler);
    return this;
};

PitchBuilder.prototype.addOut = function(octave, handler) {
    if (handler) {
        if (handler.onBind) {
            this.client.sounds[this.pitch.key() + "/outs/" + octave + "/onBind"] = Sound.fromHandler(handler.onBind);
        }
        if (handler.onUnbind) {
            this.client.sounds[this.pitch.key() + "/outs/" + octave + "/onUnbind"] = Sound.fromHandler(handler.onUnbind);
        }
    }
    this.pitch.setOut(octave);
    return this;
};

PitchBuilder.prototype.addValue = function(octave, value) {
    this.pitch.setValue(octave, value);
    return this;
};


PitchBuilder.prototype.linkArgument = function(octave, key) {
    this.pitch.linkArgument(octave, key);
    return this;
};

PitchBuilder.prototype.addDescription = function(octave, value) {
    this.pitch.setDescription(octave, value);
    return this;
};

// var PitchSelector

Symphony.prototype.updatePitch = function(pitch) {
    if (!pitch || !pitch.id) {
        throw new Error("invalid pitch");
    }
    if (this.toneDoc && this.toneDoc.type) {
        var currentPitch = this.toneDoc.data.pitches[pitch.id];
        if (!currentPitch) {
            console.log("pitch not registered" + pitch);
        } else {
            var tone = new Tone(this.toneDoc.data);
            var ops = tone.addPitch(pitch);
            if (ops && ops !== []) {
                this.toneDoc.submitOp(ops);
                this.updateChildren(ops);
            }
            // currentPitch = new Pitch(currentPitch);
            // var ops = currentPitch.diff(pitch, null,["handler"]);
            // if (ops && ops !== []) {
            //     Cue.prependPath(["pitches",pitch.id], ops);
            //     console.log("updating pitch", ops);
            //     this.toneDoc.submitOp(ops);
            //     this.updateChildren(ops);
            // }
        }
    }
};

Symphony.prototype.broadcastCue = function(cue) {
    this.socket.emit('cue', cue);
};

Symphony.prototype.close = function() {
    this.socket.close();
};

Symphony.prototype.emit = function(eventType, eventData) {
    var cue = new Cue();
    cue.type = eventType;
    cue.arguments.eventData = eventData;
    cue.arguments.toneId = this.deviceId;
    cue.arguments.instanceId = this.instanceId;

    this.broadcastCue(cue);
};


Symphony.prototype.isRegistered = function() {
    return this.toneRegistered && this.launchRegistered;
}
Symphony.prototype.setRegistered = function() {

    if (this.onRegisteredListener && this.isRegistered()) {
        this.onRegisteredListener();
    }
};

Symphony.prototype.addOnRegisteredListener = function(listener) {
    this.onRegisteredListener = listener;
};

Symphony.prototype.onToneUpdated = function(toneDoc) {
    var self = this;
    return function(ops, source) {
        console.log("tone updated " + toneDoc.id);
        if (toneDoc && toneDoc.type && toneDoc.data) {
            if (toneDoc.id === self.deviceId) {
                self.toneRegistered = true;
            }
            if (toneDoc.id in self.symphonyListeners.tones) {
                self.symphonyListeners.tones[toneDoc.id].forEach(function(listener) {
                    listener(toneDoc, op, source);
                });
            }

            var tone = new Tone(toneDoc.data);

            if (ops) {
                for (var i = 0; i < ops.length; i++) {
                    var op = ops[i];
                    if (op.od) {
                        if (op.p && op.p.length > 1 && op.p[1] === "activeChords") {
                            var cId = op.od;
                            var chordDoc = self.getDoc('chords', cId);
                            chordDoc.removeAllListeners();
                        }
                    }
                }
            }

            for (var hId in tone.harmonies) {
                //already exists
                var harmony = tone.harmonies[hId];
                if (harmony.sourceChord /*&& !self.isSynced("chords", harmony.sourceChord)*/ ) {
                    var localDoc = self.getDoc('chords', harmony.sourceChord);
                    var listener = self.onChordUpdated(localDoc);
                    localDoc.fetch(listener);
                    localDoc.removeAllListeners(); //hack
                    localDoc.on('op', listener);
                }

                if (harmony.targetChord /*&& !self.isSynced("chords", harmony.targetChord)*/ ) {
                    var targetDoc = self.getDoc('chords', harmony.targetChord);
                    var listener = self.onChordUpdated(targetDoc);
                    targetDoc.fetch(listener);
                    targetDoc.removeAllListeners(); //hack
                    targetDoc.on('op', listener);
                }
            }


            self.onOperation("tone", tone, ops);
        }
    };

}

Symphony.prototype.onChordUpdated = function(chordDoc) {
    var self = this;
    return function(ops, source) {
        if (chordDoc && chordDoc.type && chordDoc.data) {
            if (chordDoc.id in self.symphonyListeners.chords) {
                self.symphonyListeners.chords[chordDoc.id].forEach(function(listener) {
                    listener(chordDoc, ops, source);
                });
            }

            var chord = new Chord(chordDoc.data);
            console.log("chord updated");

            if (chord.parent !== self.deviceId) {
                for (var pId in chord.pitches) {
                    var pitch = new Pitch(chord.pitches[pId]);
                    self.pitches[pitch.key()] = pitch;
                }
                self.harmonizedChords[chord.parent] = chord;
            } else {
                // self.instances[chord.target] = chord;
            }

            self.onOperation("chord", chord, ops);
        }

    };
};


Symphony.prototype.onOperation = function(type, value, ops) {
    if (this.opListener) {
        this.opListener(type, value, ops);
    }
};

Symphony.prototype.isSynced = function(collection, id) {
    return id in this.docCache[collection];
};

Symphony.prototype.setDoc = function(collection, id, object, callback) {
    var self = this;
    Symphony.setDocument(this.connection, collection, id, object, function() {
        if (callback) {
            //rather than just calling the callback. use getDoc to ensure it is cached by the client.
            var doc = self.getDoc(collection, id);
            if (callback) callback(doc);
        }
    });


};

Symphony.prototype.getDoc = function(collection, id, callback) {
    if (!this.connection) throw new Error("Invalid symphony client");
    if ((typeof collection !== "string") || !(collection in this.docCache)) throw new Error("Invalid collection: " + collection);

    if (id in this.docCache[collection]) {
        var doc = this.docCache[collection][id];
        if (callback) callback(doc);
        return doc;
    }
    //retrieve from sharejs
    else {
        var doc = this.connection.get(collection, id);
        //add to cache
        this.docCache[collection][id] = doc;
        doc.subscribe(callback);
        return doc;
    }
};

Symphony.prototype.updateLocalDocs = function() {
    if (!this.tone) return;

    for (var i = this.tone.notes.length - 1; i >= 0; i--) {
        var noteId = this.tone.notes[i];
        this.getDoc("notes", noteId);
    };

    for (var i = this.tone.chords.length - 1; i >= 0; i--) {
        var chordId = this.tone.chords[i];
        this.getDoc("chords", chordId);
    };
};


Symphony.prototype.addSymphonyListener = function(collection, id, listener) {
    var self = this;
    if (!id) {
        id = Cue.createUUID();
    }
    if (collection in this.symphonyListeners) {
        var collectionListeners = self.symphonyListeners[collection];
        if (id in collectionListeners) {
            var listeners = collectionListeners[id];
            listeners.push(listener);
        } else {
            collectionListeners[id] = [listener];
        }
    }
    return id;
};

Symphony.prototype.removeSymphonyListener = function(collection, id, listener) {
    var self = this;
    if (collection in this.symphonyListeners) {
        var collectionListeners = self.symphonyListeners[collection];
        if (id && (id in collectionListeners)) {
            var listeners = collectionListeners[id];
            if (listeners instanceof Array) {
                var index = listeners.indexOf(listener);
                while (index && listeners instanceof Array) {
                    listeners.splice(index, 1);
                    index = listeners.indexOf(listener);
                }
            }
        }
    }
};

Symphony.prototype.clearSymphonyListeners = function(collection, id) {
    var self = this;
    if (collection in this.symphonyListeners) {
        var collectionListeners = self.symphonyListeners[collection];
        if (id && (id in collectionListeners)) {
            collectionListeners[id] = [];
        }
    }
};

//set application(Tone) argument
Symphony.prototype.putArgument = function(key, value) {
    self = this;
    if (this.toneDoc && this.toneDoc.type) {
        var toneDoc = this.toneDoc;
        toneDoc.fetch(function() {
            var tone = new Tone(toneDoc.data);
            var ops = tone.putArgument(key, value);
            toneDoc.submitOp(ops);
            //launch
            self.updateChildren(ops);
        });
    } else {
        //add later
    }
};

//set application(Tone) argument
Symphony.prototype.putArguments = function(args) {
    var self = this;
    if (!args && typeof args === "object") return;
    if (this.toneDoc && this.tone) {
        var ops = [];
        var doc = this.toneDoc;
        for (var k in args) {
            var op = this.tone.putArgument(k, args[k]);
            console.log("op arg", op);
            if (op) {
                ops = ops.concat(op);
            }
        }
        // console.log("ops ", ops);
        doc.fetch(function() {
            doc.submitOp(ops, function(e) {
                if (e) console.log(e);
            });
        });

        //apply filtered changes to
        self.updateChildren(ops);
    } else {
        //add later
    }
};


//set application(Tone) argument
Symphony.prototype.getArgument = function(key) {
    if (this.toneDoc && this.toneDoc.type) {
        if (this.toneDoc.data.arguments && key in this.toneDoc.data.arguments) {
            return this.toneDoc.data.arguments[key];
        }
    } else {
        //add later
    }
};

//set application(Tone) argument
Symphony.prototype.getPitch = function(key) {
    if (this.toneDoc && this.toneDoc.type) {
        if (this.toneDoc.data.pitches && key in this.toneDoc.data.pitches) {
            return this.toneDoc.data.pitches[key];
        } else if (key in this.pitches) {
            return this.pitches[key];
        }
    } else {
        //add later
    }
};

//todo: logical name
Symphony.prototype.updateChildren = function(ops) {
    var self = this;
    for (var hId in self.toneDoc.data.harmonies) {
        var local = self.toneDoc.data.harmonies[hId].sourceChord;
        if (local) {
            var chordDoc = self.getDoc("chords", local);
            chordDoc.fetch(function() {
                chordDoc.submitOp(ops);
            });
        }
    }
}

//set application(Tone) argument
Symphony.prototype.putRegisteredArgument = function(key, value, pitchParams) {
    self = this;
    pitchParams.id = key;
    self.putArgument(key, value);
    return self.register(pitchParams);
};

Symphony.prototype.isHarmonized = function(id) {
    //Todo parse different address types
    return id in this.harmonizedChords;
};
//callback = function(chord)
Symphony.prototype.harmonize = function(id, callback) {
    // if(!this.toneDoc){
    //     throw new Error("Can't harmonize before client initializes connection with server");
    // }
    //Todo parse different address types
    var self = this;

    if (this.isHarmonized(id)) { //already harmonized
        if (callback) {
            callback(this.harmonizedChords[id]);
        }
    } else {
        self.toneDoc.fetch(function() {
            var tone = new Tone(self.toneDoc.data);
            //add new harmony
            var ops = tone.addHarmony(id);
            //generate chord

            self.toneDoc.submitOp(ops, function() {
                self.updateChord(id, null, function() {
                    self.socket.emit("harmonize", { "source": self.deviceId, "target": id }, function(response) {
                        console.log("hazah", response);
                        //todo:check valid
                        var chordDoc = self.getDoc("chords", response);
                        var harmony = new Harmony(self.toneDoc.data.harmonies[id]);
                        var ops = harmony.setTarget(response);
                        self.toneDoc.submitOp(ops);
                        chordDoc.fetch(function() {
                            if (chordDoc.type) {
                                var chord = new Chord(chordDoc.data);
                                self.harmonizedChords[id] = chord;
                                if (callback) {
                                    callback(chord)
                                }
                            }
                        });
                    });
                });
            });
        });

        //TODO:
        // if(callback) {
        //     this.pendingHarmonyCallbacks[id] = callback;
        // }
    }

};

Symphony.prototype.deharmonize = function(id, callback) {
    //Todo parse different address types

    // if (id in this.harmonizedChords) {
    //     var chordDoc = this.getDoc(this.harmonizedChords[id]);
    //     if (chordDoc.type) {
    //         callback(chordDoc.data);
    //         return chordDoc.data;
    //     }
    // }
    var self = this;

    self.toneDoc.fetch(function() {
        var tone = new Tone(self.toneDoc.data);
        var ops = tone.removeHarmony(id);
        self.toneDoc.submitOp(ops, function() {});
    });

    var deharmonizeData = {
        target: id,
        source: this.deviceId
    };

    this.socket.emit('deharmonize', deharmonizeData);
};

// Symphony.prototype.onHarmonize = function(id, callback) {

// };

Symphony.prototype.createInterval = function(localPitch, remotePitch) {
    var self = this;
    if (self.toneDoc) {
        self.toneDoc.fetch(function() {
            if (self.toneDoc.type) {
                var tone = new Tone(self.toneDoc.data);
                var ops = tone.createInterval(localPitch, remotePitch);
                var interval = tone.intervals[localPitch.id, remotePitch.key()];
                // self.addSymphonyListener("notes", remotePitch.parent, function(doc, op, source) {
                //     console.log("watching", doc, op, source);
                //     // RIGHT HERE!!!!!!!!!!!!!!!
                // });
                self.toneDoc.submitOp(ops);
                // self.updateChildren(ops);
            }
        });
    }
};

Symphony.prototype.removeInterval = function(localPitch, remotePitch) {
    var self = this;
    if (self.toneDoc) {
        self.toneDoc.fetch(function() {
            if (self.toneDoc.type) {
                var tone = new Tone(self.toneDoc.data);
                var ops = tone.removeInterval(localPitch, remotePitch);
                var interval = tone.intervals[localPitch.id, remotePitch.key()];

                self.toneDoc.submitOp(ops);
                self.updateChildren(ops);
            }
        });
    }
};

Symphony.prototype.getIntervals = function(pitch) {
    var self = this;
    if (self.toneDoc && self.toneDoc.type) {
        var tone = new Tone(self.toneDoc.data);
        if (pitch.key === undefined) {
            pitch = new Pitch(pitch);
        }
        return tone.getIntervals(pitch);

    }
};




//id:target id
//ops: changes to parent tone
Symphony.prototype.updateChord = function(id, ops, callback) {
    var self = this;
    var tone = new Tone(self.toneDoc.data);
    var harmony = new Harmony(tone.harmonies[id]);
    if (!harmony.sourceChord) { //create new chord
        var chord = tone.generateChord(id, self.toneDoc.data);
        self.instances[id] = chord;
        self.setDoc("chords", chord.id, chord, function() {
            var ops = harmony.setSource(chord.id);
            self.toneDoc.submitOp(ops, function() {
                if (callback) {
                    callback(chord);
                }
            });
        });
    } else {
        var chordDoc = self.getDoc("chords", harmony.sourceChord);
        var chord = new Chord(this);
        var ops = [{ 'p': [], 'oi': chord }];
        chordDoc.submitOp(ops, function() {
            if (callback) {
                callback(chord);
            }
        });
    }
};


Symphony.prototype.addDocListener = function(collection, docId, docListener) {
    if (!docListener) throw new Error("invalid listener"); //TODO:validate listener

    var listenerList = this.docListeners[docId];
    if (!listenerList || !Array.isArray(listenerList)) {
        listenerList = [docListener];
    } else {
        listenerList.push(docListener);
    }
    this.docListeners[docId] = listenerList;
};

Symphony.prototype.removeDocListener = function(collection, docId, docListener) {
    if (!docListener) throw new Error("invalid listener"); //TODO:validate listener

    var listenerList = this.docListeners[docId];
    if (!listenerList || !Array.isArray(listenerList)) {
        throw new Error("invalid doc id");
    } else {
        var index = listenerList.indexOf(docListener);
        if (index) {
            listenerList.splice(index);
        }
        this.docListeners[docId] = listenerList;
    }
}

Symphony.updateDocument = function(connection, collection, id, data, callback) {
    if (!connection || !collection || !data || !data.id) {
        throw new Error("invalid input");
    }
    callback = callback ? callback : function(err) {
        if (err) {
            console.log(err);
        }
    };
    dataType = 'json0';

    var doc = connection.get(collection, id);
    if (!doc.type) { //create if doesn't exist
        console.log("creating new " + collection + "(" + id + "):", ops);
        doc.create(data, dataType, callback);
    } else if (!doc.data) { //??? replace
        console.log("overwriting " + collection + "(" + id + "):", ops);
        doc.submitOp([{
            oi: data,
            p: []
        }], callback);
    } else { //generate transforms to create new version
        var current = doc.data;
        var ops = deepDiffMapper.map([], current, data);
        console.log("ops for " + collection + "(" + id + "):", ops);
        if (ops !== null && ops !== []) {
            doc.submitOp(ops, callback);
        }
    }
}


Symphony.setDocument = function(connection, collection, id, data, callback) {
    if (!connection || !collection || !data || !data.id) {
        throw new Error("null input");
    }
    dataType = 'json0';

    var doc = connection.get(collection, id);
    if (!doc.type) { //create if doesn't exist
        doc.create(data, dataType, function() {
            doc.submitOp([{
                oi: data,
                p: []
            }], function() {
                if (callback) callback();
            });
        });
    } else { //overwrite
        doc.submitOp([{
            oi: data,
            p: []
        }], function() {
            if (callback) callback();
        });
    }
};


Symphony.prototype.getListeners = function(eventType) {
    console.log(require('util').inspect(frontDoor.listeners(eventType))); // Outputs ring
};

Symphony.parseSelector = function(selector) {
    if (typeof selector !== "string") {
        throw (new Error("invalid selector(not string)"));
    }
    var result = {};
    result.include = {};
    result.exclude = {};
    var slashToken = "_d_";
    selector.replace("/", slashToken);
    var parsedSelector = slick.parse(selector);
    if (parsedSelector.length > 0) {
        for (var j = parsedSelector.length - 1; j >= 0; j--) {
            var queries = parsedSelector[j];
            for (var i = queries.length - 1; i >= 0; i--) {
                var q = queries[i];
                var instrumentType = q.tag || "*";
                var pitchType = q.id || "*";
                var flags = -1;
                if (q.pseudos) {
                    flags = 0;
                    for (var p = 0; p < q.pseudos.length; p++) {
                        var flagName = q.pseudos[p].name.replace(slashToken, "/");
                        switch (flagName) {
                            case "in":
                                flags |= Pitch.FLAG_IN;
                                break;
                            case "out":
                                flags |= Pitch.FLAG_OUT;
                                break;
                            case "value":
                                flags |= Pitch.FLAG_VALUE;
                                break;
                        }
                    }
                }
                var subResult;
                switch (q.combinator) {
                    case " ":
                    case "+":
                        subResult = result.include;
                        break;
                    case "!":
                        subResult = result.exclude;
                        break;
                    default:
                        throw new Error("unknown combinator: "+q.combinator);
                        break;
                }
                if (!subResult[instrumentType]) {
                    subResult[instrumentType] = {};
                } 
                if (!subResult[instrumentType][pitchType]) {
                    subResult[instrumentType][pitchType] = {};
                }
                var keys = subResult[instrumentType][pitchType];

                if (q.attributes) {
                    for (var k = 0; k < q.attributes.length; k++) {
                        var key = q.attributes[k].name.replace(slashToken, "/");
                        if (key in keys) {
                            keys[key] |= flags;
                        } else {
                            keys[key] = flags;
                        }
                    }
                } else {
                    if ("*" in keys) {
                        keys["*"] |= flags;
                    } else {
                        keys["*"] = flags;
                    }
                }
            }
        }
    }
    return result;
};

//
Symphony.prototype.query = function(selector) {
    var result = {};
    var params;
    if (typeof selector === "string") { //selector
        //hack to let slick handle the slashes present in mime types
        params = Symphony.parseSelector(selector);
    } else if (typeof selector === "object") {
        params = selector;
    }


    for (var itemId in this.pitches) {
        var pitch = this.pitches[itemId];
        var iId = pitch.parent;

        if (!params) { //include all
            if (!(iId in result)) {
                result[iId] = {};
            }
            result[iId][pitch.id] = pitch;
            continue;
        }

        if (params.exclude && Symphony.match(pitch, params.exclude)) {
            continue;
        }

        if (params.include && Symphony.match(pitch, params.include)) {
            if (!(iId in result)) {
                result[iId] = {};
            }
            result[iId][pitch.id] = pitch;
        }

    }

    return result;
};

Symphony.match = function(pitch, query) {
    var iId = pitch.parent;
    var pIds = query[iId] || query["*"];
    if (pIds !== undefined) {
        if (!pIds) {
            return true;
        } else if (pitch.id in pIds) {
            return true;
        } else if ("*" in pIds) {
            var kFlags = pIds["*"];
            if (!kFlags) {
                return true;
            } else {
                for (var kId in kFlags) {
                    var flags = kFlags[kId];
                    if (kId in pitch.octaves) { //contains key and has the same flags
                        if (flags === -1 || (pitch.getOctaveFlags(kId) & flags > 0)) {
                            return true;
                        }
                    } else if (kId === "*") {
                        if (flags === -1) {
                            return true;
                        } else {
                            for (var oId in pitch.octaves) {
                                if ((pitch.octaves[oId] & flags) > 0) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

Symphony.prototype.reset = function(template) {
    if (this.doc.state !== 'ready') {
        console.log('not ready');
        return;
    }

    switch (template) {
        default: this.doc.del();
        this.doc.create('json0', templates.a);
    }
};

//TODO:remove (Debugging) 
if (require.main === module) {
    var host = "http://localhost:3000";
    if (process.argv.length > 2) {
        host = process.argv[2];
    }
    console.log("connecting to " + host);

    var io = require('socket.io-client', {
        expose: 'io'
    });
    var s = new Symphony({
        "host": host,
        "socketModule": io,
        "type": "test",
        'arguments': {
            'icon': 'fa-keyboard-o'
        }
    });
}
