var Duplex = require('stream').Duplex;
// var sharejs = require('share');

var Cue = require('../cue.js').Cue;
var Chord = require('../chord.js').Chord;
var Tone = require('../tone.js').Tone;
var AndroidClient = require('../client/android');

//hack
var Connection = require('../../node_modules/sharedb/lib/client/connection');

const util = require('util');
const EventEmitter = require('events').EventEmitter;


var SymphonyConnection = module.exports = function(socket, symphonydb) {
    var self = this;
    this.socket = socket;
    this.symphonydb = symphonydb;
    this.backend = symphonydb.backend;
    // console.log(symphonydb);

    this.connectionType = 'default';

    this.toneId = null;

    var cueHandlers = this.cueHandlers = {};
    // this.on("addTone", this.addTone);
    // this.on("dismissTone", this.dismissTone);

    console.log('-- ' + socket.id + ' joined --');
    socket.emit('id', socket.id);

    var stream = this.stream = new Duplex({
        objectMode: true
    });
    stream._read = function() {};

    socket.on('cue', this.handleCue.bind(this));
    socket.on("setConnectionParams", this.handleSetConnectionParams.bind(self));

    function leave() {
        console.log('-- ' + socket.id + ' left --');
        stream.push(null);
        stream.emit('close');
        self.symphonydb.removeInstance(self.toneId, self.socket.id);
    }

    socket.on('disconnect', leave);
    socket.on('leave', leave);
    socket.on('close', leave);

    stream.on('end', function() {
        socket.disconnect();
    });

    //cue handlers
    this.addCueHandler("chordEvent", this.handleChordEvent.bind(self));

};

util.inherits(SymphonyConnection, EventEmitter);

SymphonyConnection.prototype.handleCue = function(cue) {
    var self = this;
    var handled = false;
    var socket = self.socket;


    // console.log("arguments: " + c.arguments);

    if (cue.type in self.cueHandlers) {
        //TODO: handlers hosted on server side?
        handled = self.cueHandlers[cue.type].bind(self)(cue);
        console.log("handling cue", cue.type);
    }

    //if not handled by server handlers
    if (!handled) {
        console.log("routing cue", cue.type);
        self.emit("broadcastTo", { "to": self.toneId, "key": "cue", "value": cue });
    }
};

SymphonyConnection.prototype.handleRouteEvent = function(event, response) {
    this.emit("routeEvent", { "key": event.key, "event": event }, response);
};

SymphonyConnection.prototype.handleChordEvent = function(cue) {
    var self = this;
    var toneId = cue.arguments.toneId;
    if (toneId in self.symphonydb.db.docs.tones) {
        var toneDoc = self.symphonydb.db.docs.tones[toneId];
        if (toneDoc.type) {
            var tone = toneDoc.data;
            for (var cId in tone.activeChords) {
                self.emit("broadcastTo", { "to": cId, "key": "cue", "value": cue });
                // self.socket.broadcast.to(cId).emit("chordEvent", cue);
            }
        }
        return true;
    }
};

SymphonyConnection.prototype.harmonize = function(args, ack) {
    var self = this;
    var source = args['source'];
    var target = args['target'];

    if (self.symphonydb.db.docs.tones && target in self.symphonydb.db.docs.tones) {
        var targetDoc = self.symphonydb.getDocument("tones", target);
        targetDoc.fetch(function() {
            if (targetDoc.type) {
                var targetTone = new Tone(targetDoc.data);
                var ops = targetTone.addHarmony(source);
                var harmony = targetTone.harmonies[source];
                var chord = targetTone.generateChord(source);
                ops.concat(harmony.setSource(chord.id));

                var sourceDoc = self.symphonydb.db.docs.tones[source];
                if (sourceDoc.type && target in sourceDoc.data.harmonies) {
                    ops.concat(harmony.setTarget(sourceDoc.data.harmonies[target].sourceChord));
                }
                self.symphonydb.updateChord(chord, function() {
                    targetDoc.submitOp(ops, function() {
                        if (ack) {
                            ack(chord.id);
                        }
                    });
                });
            }
        });
    } else {
        console.log("invalid harmony", args);
    }
};

SymphonyConnection.prototype.deharmonize = function(args) {
    var self = this;
    var source = args['source'];
    var target = args['target'];

    if (self.symphonydb.db.docs.tones && source in self.symphonydb.db.docs.tones && target in self.symphonydb.db.docs.tones) {

        var sourceDoc = self.symphonydb.getDocument('tones', source);
        var targetDoc = self.symphonydb.getDocument('tones', target);

        var chord = self.symphonydb.getChords(source, target);
        if (chord) {
            sourceDoc.fetch(function(e) {
                var sourceTone = new Tone(sourceDoc.data)
                var ops = sourceTone.removeChord(chord.id);
                if (ops.length)
                    sourceDoc.submitOp(ops);
            });
            var targetTone = new Tone(targetDoc.data)
            targetDoc.fetch(function(e) {
                var targetTone = new Tone(targetDoc.data)
                var ops = targetTone.removeChord(chord.id);
                if (ops.length)
                    targetDoc.submitOp(ops);
            });
        }
    } else {
        console.log("invalid harmony", args);
    }
};

SymphonyConnection.prototype.addCueHandler = function(eventType, handler) {
    this.cueHandlers[eventType] = handler;
};

SymphonyConnection.prototype.handleSymphonyOperation = function(cue) {
    opType = cue.arguments.operationType;
    // if (this.mid && this.mid.doc && this.mid.doc.type && opType) {
    switch (opType) {
        case "tone":
            var t = JSON.parse(cue.arguments.value);
            var path = ["tones", t.id];
            this.mid.doc.submitOp({
                p: path,
                oi: t
            });
            break;
        case "chord":
            var c = JSON.parse(cue.arguments.value);
            var path = ["chords", c.id];
            this.mid.doc.submitOp({
                p: path,
                oi: c
            });
            break;

        case "snapshot":
            var s = JSON.parse(cue.arguments.snapshot);
            // console.log("barrk", this.mid.doc.snapshot);
            // console.log("grrrr", s);
            if (s) {
                if (s.melodies) {
                    for (var mId in s.melodies) {
                        this.symphonydb.updateMelody(s.melodies[mId]);
                    }
                }
                if (s.tones) {
                    for (var tId in s.tones) {
                        this.symphonydb.updateTone(s.tones[tId]);
                    }
                }
                if (s.chords) {
                    for (var cId in s.chords) {
                        this.symphonydb.updateChord(s.chords[cId]);
                    }
                }
                if (s.notes) {
                    for (var nId in s.notes) {
                        this.symphonydb.updateNote(s.notes[nId]);
                    }
                }
            }

            if (s.melodies) {

            } else {
                
            }


            // var diff = deepDiffMapper.map([], this.mid.doc.snapshot, s, ["inHooks", "mNotes", "outHooks", "ensemble", "history", "chordHistory"]);
            // console.log("meow", diff);
            // if (diff && diff.length) {
            //   this.mid.doc.submitOp(diff);
            //   this.mid.doc
            // }

            break;
        case "batch":
            ops = [];
            if (cue.arguments.tones) {
                ts = JSON.parse(cue.arguments.tones);
                for (var tone in ts)

                {
                    tone = JSON.parse(ts[tone]);
                    ops.push({
                        p: ['tones', tone.id],
                        oi: tone
                    });
                }
            }
            if (cue.arguments.notes) {
                ts = JSON.parse(cue.arguments.notes);
                for (var note in ts)

                {
                    note = JSON.parse(ts[note]);
                    ops.push({
                        p: ['notes', note.id],
                        oi: note
                    });
                }
            }
            if (cue.arguments.chords) {
                ts = JSON.parse(cue.arguments.chords);
                for (var chord in ts)

                {
                    chord = JSON.parse(ts[chord]);
                    if (this.mid.doc.snapshot.chords && chord.id in this.mid.doc.snapshot.chords) {
                        ops.push({
                            p: ['chords', chord.id],
                            od: this.mid.doc.snapshot.chords[chord.id],
                            oi: chord
                        });
                    } else {
                        ops.push({
                            p: ['chords', chord.id],
                            oi: chord
                        });
                    }
                }
            }
            if (cue.arguments.melodies) {
                ts = JSON.parse(cue.arguments.melodies);
                for (var melody in ts)

                {
                    melody = JSON.parse(ts[melody]);
                    ops.push({
                        p: ['melodies', melody.id],
                        oi: melody
                    });
                }
            }
            this.mid.doc.submitOp(ops);
            break;
    }
    // }
};

SymphonyConnection.prototype.addTone = function(cue) {
    var tId = cue.arguments.toneType; //(TODO: change to toneId)
    var snapshot = this.mid.doc.getSnapshot();
    if (!snapshot || !(tId in snapshot.tones)) {
        console.log("tone " + tId + " doesn't exist");
        return;
    } else {
        var ops = [];
        var historyIndex = snapshot.history.indexOf(tId);
        if (historyIndex === -1) {

            var historyPath = ['history', historyIndex];
            ops.push({
                p: historyPath,
                ld: tId
            });
        }
        if (snapshot.toneOrder.indexOf(tId) === -1) {
            var shownPath = ['toneOrder', 0];
            ops.push({
                p: shownPath,
                li: tId
            });
        }
        this.mid.doc.submitOp(ops);
    }

};
SymphonyConnection.prototype.dismissTone = function(cue) {
    // console.log(cue.arguments.tone);
    var t = JSON.parse(cue.arguments.tone);
    var snapshot = this.mid.doc.getSnapshot();
    if (snapshot) {
        var ops = [];
        var orderIndex = snapshot.toneOrder.indexOf(t.id);
        if (orderIndex === -1) {
            console.log("tone " + t.id + " isn't in shownNotes");
            return;
        }
        var shownPath = ['toneOrder', orderIndex];
        ops.push({
            p: shownPath,
            ld: t.id
        });
        if (snapshot.history.indexOf(t.id) === -1) {

            var historyPath = ['history', 0];
            ops.push({
                p: historyPath,
                li: t.id
            });
        }
        this.mid.doc.submitOp(ops);
    }
};



SymphonyConnection.prototype.handleSetConnectionParams = function(args, callback) {
    var self = this;
    console.log('setting connection params for ' + args.connectionType);

    if (args.melodyId) {
        var melodyId = this.melodyId = args.melodyId;
    }

    if ('connectionType' in args) {
        self.connectionType = args.connectionType;
        var socket = this.socket;
        var stream = this.stream;
        switch (args.connectionType) {
            case 'android': //hack

                stream._write = function(chunk, encoding, callback) {
                    console.log("android? ");
                    androidSocketInterface.clientSocket.onmessage({
                        data: chunk
                    });
                    callback();
                };

                var androidSocketInterface = self.androidSocketInterface = new AndroidClient(socket, args, callback);
                androidSocketInterface.serverSocket.on('message', function(details) {
                    console.log('message: ', details);
                    if (details.type !== 'cue')
                        stream.push(details);
                });
                androidSocketInterface.serverSocket.on("harmonize", this.harmonize.bind(self));
                androidSocketInterface.serverSocket.on("deharmonize", this.deharmonize.bind(self));
                androidSocketInterface.serverSocket.on("routeEvent", this.handleRouteEvent.bind(this));


                this.backend.listen(this.stream);

                break;
            default:
                this.stream._write = function(chunk, encoding, callback) {
                    console.log("writing? " /*, chunk*/ );
                    if (socket.connected) {
                        socket.send({
                            data: chunk
                        });
                    }
                    callback();
                };
                socket.on('message', function(details) {
                    console.log('message: ', details);
                    if (details.type !== 'cue')
                        stream.push(details);
                });


                socket.on("harmonize", this.harmonize.bind(self));
                socket.on("deharmonize", this.deharmonize.bind(self));
                socket.on("routeEvent", this.handleRouteEvent.bind(this));

                this.backend.listen(this.stream);
        }
    }

    if ('toneId' in args) {
        this.toneId = args["toneId"];
        // console.log(this.symphonydb);
        self.symphonydb.addInstance(this.toneId, this.socket.id);
    }

    return true;
};


var sendSnapshot = function(snapshot, socket) {
    snapCue = new Cue({
        type: "melodySnapshot"
    });

    console.log("sending snapshot", snapshot); //TODO: remove
    snapCue.arguments.snapshot = JSON.stringify(snapshot);
    socket.emit('cue', snapCue);
}

var deepDiffMapper = function() {
    return {
        VALUE_CREATED: 'created',
        VALUE_UPDATED: 'updated',
        VALUE_DELETED: 'deleted',
        VALUE_UNCHANGED: 'unchanged',
        map: function(path, obj1, obj2, ignore) {

            if (this.isFunction(obj1) || this.isFunction(obj2)) {
                throw 'Invalid argument. Function given, object expected.';
            }
            if (this.isValue(obj1) || this.isValue(obj2)) {
                // console.log(obj1, obj2, this.compareValues(obj1, obj2), path);
                switch (this.compareValues(obj1, obj2)) {
                    case this.VALUE_CREATED:
                        if (!isNaN(path[path.length - 1])) {
                            return [{
                                li: obj1 || obj2,
                                p: path
                            }];
                        } else {
                            return [{
                                oi: obj1 || obj2,
                                p: path
                            }];
                        }
                        break;
                    case this.VALUE_UPDATED:
                        if (!isNaN(path[path.length - 1])) {
                            return [{
                                ld: obj2,
                                li: obj1,
                                p: path
                            }];
                        } else {
                            return [{
                                oi: obj1 || obj2,
                                p: path
                            }];
                        }
                        break;
                    case this.VALUE_DELETED:
                        var val = obj1 || obj2;
                        if (!val) val = null;
                        if (!isNaN(path[path.length - 1])) {
                            return [{
                                ld: val,
                                p: path
                            }];
                        } else {
                            return [{
                                od: val,
                                p: path
                            }];
                        }
                        break;
                    case this.VALUE_UNCHANGED:
                        return null;
                }
            }
            var ops = [];
            var unchanged = [];
            for (var key in obj1) {

                if (!isNaN(key)) key = parseInt(key);
                // console.log("key " + key + ": " +ignore.indexOf(key));
                if (ignore && ignore.indexOf(key) !== -1) {
                    console.log("ignoring " + key);
                    continue;
                }

                if (this.isFunction(obj1[key])) {
                    continue;
                }

                var value2 = undefined;
                if ('undefined' != typeof(obj2[key])) {
                    value2 = obj2[key];
                }

                op = this.map(path.concat(key), obj1[key], value2, ignore);
                if (!op || !op.length) {
                    // console.log('unchanged',op,path);
                    continue;
                }
                unchanged.push(key);

                // console.log('ROAR',op,path);
                ops = ops.concat(op);

            }


            for (var key in obj2) {
                if (!isNaN(key)) key = parseInt(key);
                // console.log("exist",unchanged.indexOf(key) !== -1,key,unchanged);
                if (this.isFunction(obj2[key]) || unchanged.indexOf(key) !== -1) {

                    continue;
                }

                if (ignore && ignore.indexOf(key) !== -1) {
                    console.log("ignoring " + key);
                    continue;
                }

                for (var j = ops.length - 1; j >= 0; j--) {
                    opp = ops[j].p;
                    if (opp && arraysEqual(opp, path))
                        continue;
                }

                op = this.map(path.concat(key), undefined, obj2[key], ignore);
                if (!op) {
                    continue;
                }
                ops = ops.concat(op);

            }


            return ops;

        },
        compareValues: function(value1, value2) {
            if (value1 === value2) {
                return this.VALUE_UNCHANGED;
            }
            if ('undefined' == typeof(value1)) {
                return this.VALUE_CREATED;
            }
            if ('undefined' == typeof(value2)) {
                return this.VALUE_DELETED;
            }

            return this.VALUE_UPDATED;
        },
        isFunction: function(obj) {
            return {}.toString.apply(obj) === '[object Function]';
        },
        isArray: function(obj) {
            return {}.toString.apply(obj) === '[object Array]';
        },
        isObject: function(obj) {
            return {}.toString.apply(obj) === '[object Object]';
        },
        isValue: function(obj) {
            return !this.isObject(obj) && !this.isArray(obj);
        }
    };
}();

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}



//TODO:remove (Debugging) 
if (require.main === module) {
    
}
