var express = require('express');
var cors = require('cors')
    // var livedb = require('livedb');
    // var db_backend = require('livedb-mongo')('localhost:27017/test?auto_reconnect', {safe:true});
    // var db_backend = livedb.memory();
    // var db = livedb.client(db_backend);
    // var sharejs = require('share');

var templates = require('../templates.js');
var SymphonyConnection = require('./symphonyconnection.js');
var SymphonyDB = require('./symphonydb.js').SymphonyDB;

var ExpressPeerServer = require('peer').ExpressPeerServer;

var http = require('http');
var https = require('https');
var fs = require('fs');


var isCreated = false;


var Symphony = exports.server = function(config) {
    var self = this;

    if (!config) { //use defaults
        config = {
            'httpPort': '3000',
            'httpsPort': '3001'
        };
    }

    if (!config.httpPort && !config.httpsPort) {
        throw ("No port specified");
    }

    var symphonydb = this.symphonydb = new SymphonyDB();
    symphonydb.on("instanceEvent", handleInstanceEvent(this));
    symphonydb.on("chordUpdated", handleChordUpdated(this));

    symphonydb.resetSymphony(templates.jazz);

    var share = this.share = symphonydb.share;


    var symphonyConnections = this.symphonyConnections = {};

    var rooms = this.rooms = {};

    // this.playMusic(templates.music);

    port = this.port = config.port;
    var app = this.app = express();
    this.app.use(cors());


    // app.get('/', function(req, res) {
    //     res.send('hello world');
    // });

    // app.use(express.static(sharejs.scriptsDir));
    app.use(express.static(__dirname + '/public'));

    // app.get('/:id', function(req, res) {
    //   who = "a mystery.";
    //   if (req.params && req.params.id) {
    //     who = req.params.id;
    //   }
    //   res.send('I am ' + req.params.id);
    // });

    var io = this.io = new require('socket.io')();

    if (config.httpPort) {
        app.set('httpPort', config.httpPort);
        //create http server
        var httpServer = http.createServer(app);
        httpServer.listen(config.httpPort, function() {
            console.log('Listening on port ' + app.get('httpPort'));
        });
        io.listen(httpServer);

        config.peerPort = 9000;
        if (config.peerPort) {
            // var peerServer = this.peerServer = require('http').createServer(app);
            // app.use('/peerjs', ExpressPeerServer(peerServer, { debug: true }));
            // peerServer.listen(config.peerPort);
            app.use('/peerjs', ExpressPeerServer(httpServer, { debug: true }));
        }
    }

    if (config.httpsPort) {
        app.set('httpsPort', config.httpsPort);
        //create https server
        var privateKey = fs.readFileSync(__dirname + '/server.key', 'utf8');
        var certificate = fs.readFileSync(__dirname + '/server.crt', 'utf8');
        var credentials = {
            key: privateKey,
            cert: certificate
        };
        var httpsServer = https.createServer(credentials, app);

        httpsServer.listen(config.httpsPort, function() {
            console.log('Listening on port ' + app.get('httpsPort') + '(SSL)');
        });

        io.listen(httpsServer);

    }


    // var express_server = this.express_server = app.listen(app.get('port'), function() {
    //   console.log('Express server listening on port ' + app.get('port'));
    // });

    // var express_server = this.express_server = app.listen(app.get('port'), function() {
    //   console.log('Express server listening on port ' + app.get('port'));
    // });

    // var io = this.io = require('socket.io').listen(express_server);

    io.on('connection', function(client) {
        var sConnection = new SymphonyConnection(client, symphonydb);
        sConnection.on("broadcastTo", handleBroadcastTo(self));
        sConnection.on("routeEvent", handleRouteEvent(self));
        this.addConnection(sConnection);
    }.bind(this));

};

var handleBroadcastTo = function(self) {
    return function(args) {
        self.broadcast(args.key, args.value, args.to);
    };
};

var handleRouteEvent = function(self) {
    return function(event, response) {
        var target = event.key.split("/")[0];
        if(target in self.symphonydb.instances){
            for(var conId in self.symphonydb.instances[target]){
                if(conId in self.symphonyConnections){
                    self.symphonyConnections[conId].socket.emit("routeEvent",event, response);
                    break;
                }
            }
        }
    };
};


var handleInstanceEvent = function(self) {
    return function(args) {
        if (!args || !args.toneId || !args.instances) {
            console.log("illegal instance args");
            return;
        }
        if (args.added && args.added in self.symphonyConnections) {
            var addedInstance = self.symphonyConnections[args.added];
            if (addedInstance.connectionType === "android") {
                self.addToRoom(addedInstance, args.toneId);
            } else {
                addedInstance.socket.join(args.toneId);
            }
            //join chord channels of active chords
            //No broadcast
            if (args.toneId in self.symphonydb.chordPairs) {
                var chordTones = self.symphonydb.chordPairs[args.toneId];
                for (var tId in chordTones) {
                    var chordId = chordTones[args.toneId];
                    self.addToRoom(addedInstance, chordId);
                }
            }

        } else if (args.removed && args.removed in self.symphonyConnections) {
            //TODO
        }
        //broadcast to instances of tone

        self.broadcast("instanceEvent", args, args.toneId);
    };
};

var handleChordUpdated = function(self) {
    return function(args) {
        if (!args || !args.chord || typeof args.chord.notes !== "object") {
            console.log("illegal chord");
            return;
        }
        var chord = args.chord;

        if (chord.target && chord.target in self.symphonydb.instances) {
            var instances = self.symphonydb.instances[toneId];
            for (var instanceId in instances) {
                if (instanceId in self.symphonyConnections) {
                    var instance = self.symphonyConnections[instanceId];
                    self.addToRoom(instance, chord.id);
                }
            }
        }

    };
};

Symphony.prototype.addToRoom = function(sConnection, room) {
    if (sConnection.connectionType === "android") {
        if (!(room in this.rooms)) {
            this.rooms[room] = {};
        }
        this.rooms[room][sConnection.socket.id] = sConnection.androidSocketInterface.clientSocket;
    } else {
        sConnection.socket.join(room);
    }
}

Symphony.prototype.broadcast = function(event, data, target, response) {
    var self = this;
    if (target) {
        if (typeof target === "string") { //single room
            //broadcast to default socket io clients
            self.io.to(target).emit(event, data, response);
            //broadcast to clients partially hosted on the server(android)
            if (target in self.rooms) {
                var members = self.rooms[target];
                for (var mId in members) {
                    members[mId].emit(event, data, response);
                }
            }
        }
    } else {
        self.io.emit(event, data, response);
    }

}

Symphony.prototype.addConnection = function(sConnection) {
    if (!(sConnection.socket.id in this.symphonyConnections)) {
        this.symphonyConnections[sConnection.socket.id] = sConnection;
    }
};

//TODO:remove (Debugging) 
if (require.main === module) {
    var nconf = require('nconf');
    nconf.use('file', { 'file': 'config.json' });
    new Symphony(nconf.get('server'));

}
