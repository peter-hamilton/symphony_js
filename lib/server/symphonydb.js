var mongoClient = require('mongodb').MongoClient;
// var assert = require('assert');
var t = require('../templates.js');
var sharedb_mongo = require('sharedb-mongo');
var sharedb = require('sharedb');
// var sharejs = require('share');

var Music = require("../music.js").Music;
var Tone = require("../tone.js").Tone;
var Note = require("../note.js").Note;
var Chord = require("../chord.js").Chord;
var Harmony = require("../harmony.js").Harmony;

var deepDiffMapper = require("../deepDiffMapper");

const util = require('util');
const EventEmitter = require('events').EventEmitter;

var async = require('async');

var SymphonyDB = exports.SymphonyDB = function(dbURL) {
    var self = this;

    this.Connection = sharedb.Connection;

    var host = "localhost";
    var port = "12345";
    var sharedbURL = "mongodb://" + host + ":" + port + "/symphonylive";
    var deaddbURL = "mongodb://" + host + ":" + port + "/symphonydead";

    var deadBackend = null;

    var chordPairs = this.chordPairs = {};
    var instances = this.instances = {};


    this.ready = true;
    this.onReady = null;

    async.series(
        [
            //initialized database
            function(callback) {
                if (!dbURL) {
                    self.db = sharedb.MemoryDB();
                    self.backend = sharedb({
                        db: self.db
                    });
                    self.rcon = self.backend.connect();
                    // Subscribe to any database query
                    self.onConnected(this.rcon);

                    callback();
                } else {
                    SymphonyDB.connectDB(sharedbURL, function(err, db) {
                        if (err) {
                            throw err;
                        }
                        if (!db) {

                        }
                        self.db = db;
                        self.backend = sharedb.client(sharedb_mongo(db));
                        self.rcon = backend.connect();
                        self.onConnected(this.rcon);

                        self.resetSymphony(t.music, callback);
                        callback(err, db);

                    }.bind(self));
                }
            }.bind(self),
            //initialize sharjs
            function(callback) {

                // if (!self.backend) {
                // }

                // var share = self.share = sharejs.server.createClient({
                //  backend: self.backend
                // });
            }.bind(self)
        ],
        function(err, results) {
            // results is now equal to: {one: 1, two: 2}
        });

};

util.inherits(SymphonyDB, EventEmitter);

SymphonyDB.prototype.onConnected = function(connection) {
    // var toneQuery = connection.createSubscribeQuery('tones');
    // toneQuery.once('ready', function() {
    //  // Initially matching documents
    //  console.log('ready', toneQuery.results);
    // });
    // toneQuery.on('insert', function(docs, index) {
    //  // Documents that now match the query
    //  // console.log('insert', docs);
    //  for (var i = docs.length - 1; i >= 0; i--) {
    //      docs[i].on('op', function(op, source) {
    //          // console.log(op, source);

    //      });
    //  };
    // });
};

// SymphonyDB.prototype.onToneUpdated = function(tone) {
//     //
// };
// SymphonyDB.prototype.onNoteUpdated = function(note) {

// };
// SymphonyDB.prototype.onChordUpdated = function(chord) {
//     this.updateChordPairs(chord);
// };

SymphonyDB.prototype.setReady = function(state) {
    this.ready = state;
    if (state === true && this.onReady) {
        this.onReady();
        this.onReady = null;
    }
};

SymphonyDB.prototype.updateMelody = function(melody, callback) {

    SymphonyDB.updateDocument(this.rcon, "melodies", melody.id, melody, callback);


};
SymphonyDB.prototype.updateTone = function(tone, callback) {

    SymphonyDB.updateDocument(this.rcon, "tones", tone.id, tone, callback);

};

SymphonyDB.prototype.updateNote = function(note, callback) {

    SymphonyDB.updateDocument(this.rcon, "notes", note.id, note, callback);


};

SymphonyDB.prototype.updateChord = function(chord, callback) {

    SymphonyDB.updateDocument(this.rcon, "chords", chord.id, chord, callback);
    this.emit("chordUpdated", { "chord": chord });
};


SymphonyDB.prototype.updateChordPairs = function(chord) {
    for (var srcId in chord.notes) {

        var source = this.chordPairs[srcId];
        if (!source) {
            source = this.chordPairs[srcId] = {}
        }
        for (var trgId in chord.notes) {
            if (trgId === srcId) continue;  //ignore duplicate
            source[trgId] = chord.id;
        }
    }
    // for (var i = chord.notes.length - 1; i >= 0; i--) {
    //     var first = this.chordPairs[chord.notes[i]] = this.chordPairs[chord.notes[i]] || {};
    //     for (var j = chord.notes.length - 1; j >= 0; j--) {
    //         first[chord.notes[j]] = chord.id;
    //     };
    // };
};

SymphonyDB.prototype.getChords = function(src, target) {
    if (src in this.chordPairs) {
        var first = this.chordPairs[src];
        if (target in first) {
            return first[target];
        }
    }
    return null;
}

SymphonyDB.prototype.resetSymphony = function(template, callback) {

    //if invalid use empty template
    if (!template) {
        template = new Music();
    }
    var newMelodies = template.melodies;
    var newChords = template.chords;
    var newNotes = template.notes;
    var newTones = template.tones;
    var operations = [];

    var connection = this.rcon;

    operationFunction = function(connection, collection, id, value, callback) {
        return function(callback) {
            SymphonyDB.setDocument(connection, collection, id, value, callback);
        };
    };

    for (var mId in newMelodies) {

        var newMelody = newMelodies[mId];
        operations.push(operationFunction(connection, "melodies", newMelody.id, newMelody, callback));
        // operations.push(function(callback) {

        //  SymphonyDB.setDocument(backend, "melodies", newMelody, callback);
        // });
    }
    for (var cId in newChords) {

        var newChord = newChords[cId];
        operations.push(operationFunction(connection, "chords", newChord.id, newChord, callback));
        // operations.push(function(callback) {

        //  SymphonyDB.setDocument(backend, "chords", newChord, callback);
        // });
    }
    for (var nId in newNotes) {

        var newNote = newNotes[nId];
        operations.push(operationFunction(connection, "notes", newNote.id, newNote, callback));
        // operations.push(function(callback) {

        //  SymphonyDB.setDocument(backend, "notes", newNote, callback);
        // });
    }
    for (var tId in newTones) {
        newTone = newTones[tId];
        operations.push(operationFunction(connection, "tones", newTone.id, newTone, callback));
        // console.log("who?" + newTone.id);
        // operations.push(function(callback) {

        //  SymphonyDB.setDocument(backend, "tones", newTone, callback);
        // });
    }

    async.series(operations, callback);

};

SymphonyDB.prototype.resetMelody = function(newMelody, callback) {
    if (!newMelody) {
        newMelody = t.music.melodies.peter;
    }
};

//TODO: scope
SymphonyDB.prototype.getMusic = function() {
    if (!this.db /*|| !this.db.docs.melodies || !this.db.docs.chords || !this.db.docs.notes || !this.db.docs.tones*/ ) {

        throw this.db;
    }
    var result = {};
    var col = this.db.docs;
    console.log(col);
    result.melodies = {};
    if (col.melodies) {
        for (var m in col.melodies) {
            var melody = col.melodies[m];
            result.melodies[m] = melody.data;
        }
    }
    result.chords = {};
    if (col.chords) {
        for (var c in col.chords) {
            var chord = col.chords[c];
            result.chords[c] = chord.data;
        }
    }
    result.tones = {};
    if (col.tones) {
        for (var t in col.tones) {
            var tone = col.tones[t];
            result.tones[t] = tone.data;
        }
    }
    result.notes = {};
    if (col.notes) {

        for (var n in col.notes) {
            var note = col.notes[n];
            result.notes[n] = note.data;
        }

    }
    // console.log("music result:", result);
    return result;
};

SymphonyDB.prototype.whenReady = function(action) {
    if (this.ready) {
        action();
    } else {
        this.onReady = action;
    }
};

SymphonyDB.prototype.updateDocument = function(collection, id, data, callback) {
    if (this.rcon) {
        SymphonyDB.updateDocument(this.rcon, collection, id, data, callback);
    }
};


SymphonyDB.prototype.setDocument = function(collection, id, data, callback) {
    if (this.rcon) {
        SymphonyDB.setDocument(this.rcon, collection, id, data, callback);
    }
};


SymphonyDB.prototype.getDocument = function(collection, id) {
    var result;
    if (this.rcon) {
        result = SymphonyDB.getDocument(this.rcon, collection, id);
    }
    return result;
};


SymphonyDB.prototype.addInstance = function(toneId, instanceId) {
    if (toneId in this.instances) {
        var toneInstances = this.instances[toneId];
        toneInstances[instanceId] = true;
    } else {
        this.instances[toneId] = {};
        this.instances[toneId][instanceId] = true;
    }
    this.emit("instanceEvent", { "toneId": toneId, "added": instanceId, "instances": this.instances[toneId] });
};

SymphonyDB.prototype.removeInstance = function(toneId, instanceId) {
    if (toneId in this.instances) {
        var toneInstances = this.instances[toneId];
        if (instanceId in toneInstances) {
            delete toneInstances[instanceId];
            this.emit("instanceEvent", { "toneId": toneId, "removed": instanceId, "instances": this.instances[toneId] });
        }
    }
};

SymphonyDB.updateDocument = function(connection, collection, id, data, callback) {
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
    doc.fetch(function() {


        if (!doc.type) { //create if doesn't exist
            console.log("creating new " + collection + "(" + id + "):", data);
            doc.create(data, dataType, callback);
        } else if (!doc.data) { //??? replace
            console.log("overwriting " + collection + "(" + id + "):", data);
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
    });
}


SymphonyDB.setDocument = function(connection, collection, id, data, callback) {
    if (!connection || !collection || !data || !data.id) {
        throw new Error("null input");
    }
    dataType = 'json0';

    var doc = connection.get(collection, id);
    if (!doc.type) { //create if doesn't exist
        doc.create(data, dataType, callback);
    } else { //overwrite
        doc.submitOp([{
            oi: data,
            p: []
        }], callback);
    }

};

SymphonyDB.getDocument = function(connection, collection, id) {
    return connection.get(collection, id);
}


SymphonyDB.connectDB = function(url, callback) {
    mongoClient.connect(url, callback);
};

SymphonyDB.removeDocument = function(db, documentName, callback) {
    // // Get the documents collection
    // var collection = db.collection('documents');
    // // Insert some documents
    // collection.remove({
    //  a: 3
    // }, function(err, result) {
    //  assert.equal(err, null);
    //  assert.equal(1, result.result.n);
    //  console.log("Removed the document with the field a equal to 3");
    //  callback(result);
    // });
};



function arraysEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

//TODO:remove (Debugging) 
if (require.main === module) {

    d = new SymphonyDB();

    // console.log(t.music.notes);
    d.whenReady(function() {
        console.log(d.resetSymphony(t.music, function(err, result) {
            // console.log(d.db.docs.melodies.peter.data);
            z = d.db.docs.notes;
            console.log(z);
            // z = JSON.parse(z);
            // z.id = 'cat';
            // z.type = "dog";

            // var q = deepDiffMapper.map([], d.db.docs.melodies.peter.data, z);
            // console.log(JSON.parse(JSON.stringify(z.clipboard.data)));
            // console.log(q)

        }));
    });



}
