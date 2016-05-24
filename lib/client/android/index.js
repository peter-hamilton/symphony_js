const util = require('util');
const EventEmitter = require('events').EventEmitter;


//Middleman for android client which sends commands through socket
var AndroidSocketInterface = module.exports = function(socket, args, callback) {
    var self = this;
    this.socket = socket;
    this.clientSocket = new SimulatedSocket();
    this.serverSocket = new SimulatedSocket();

    this.socket.on("message", function(data) {
        self.onmessage(data);
    });
    this.socket.on("error", function(data) {
        self.serverSocket.onerror(data);
        self.clientSocket.onerror(data);
    });
    this.socket.on("connecting", function(data) {
        self.serverSocket.onopen(data);
        self.clientSocket.onopen(data);
    });
    this.socket.on("connect", function(data) {
        // self.onopen(data);
    });
    this.socket.on("close", function(data) {
        self.serverSocket.onclose(data);
        self.clientSocket.onclose(data);
    });

    this.clientSocket.send = function(value) {
        self.serverSocket.emit("message", value);
    };
    this.serverSocket.send = function(value) {
        self.clientSocket.emit("message", value);
    };

    this.clientSocket.on("message", function(value) {
        self.clientSocket.onmessage(value);
    });

    var BaseClient = this.BaseClient = require('../');
    BaseClient.defaultSocketModule = function(host) {
        return self.clientSocket;
    };

    //override onOperationListener 
    var superOnOperation = BaseClient.client.prototype.onOperation;
    BaseClient.client.prototype.onOperation = function(type, value, ops) {
        console.log("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",type, ops);
        self.onOperation(type, value, ops);
        superOnOperation(type, value, ops);
    };

    //android function calls
    this.socket.on("getDocuments", this.getDocuments.bind(this));
    this.socket.on("harmonize", this.harmonize.bind(this));
    this.socket.on("deharmonize", this.deharmonize.bind(this));
    this.socket.on("register", this.register.bind(this));
    this.socket.on("putArgument", this.putArgument.bind(this));
    this.socket.on("getArgument", this.getArgument.bind(this));
    this.socket.on("match", this.match.bind(this));
    this.socket.on("execute", this.execute.bind(this));
    this.socket.on("cue", this.handleCue.bind(this));

    this.handleSetConnectionParams(args, callback);
};
util.inherits(AndroidSocketInterface, EventEmitter);

var SimulatedSocket = function() {
    this.readyState = 1;
    this.canSendWhileConnecting = true;
    this.onmessage = function() {};
    this.onerror = function() {};
};
util.inherits(SimulatedSocket, EventEmitter);

AndroidSocketInterface.prototype.handleSetConnectionParams = function(args, callback) {
    if (!args || !args.toneId) {
        throw ("invalid connection params for android client");
    }
    var self = this;
    var host = "localhost"; //doesn't matter
    var id = args.toneId;

    self.client = new self.BaseClient.client({
        "host": host, //host of symphony serverd
        "deviceId": id, //if null, random UUID
        "type": "android", //type of class
        'arguments': {
            'icon': 'fa-tablet' //Font Awesome Icon
        }
    }, function() {
        self.socket.emit("ready", self.generateLocalDocuments());
    });

    if (callback) {
        callback();
    }
};

AndroidSocketInterface.prototype.getDocuments = function(data, ack) {
    var result = generateLocalDocuments();
    if (ack) {
        ack(result);
    }
};

AndroidSocketInterface.prototype.onOperation = function(type, value, ops) {
    var self = this;
    self.socket.emit("update", {type:type, "value":value, "ops": ops});
};

AndroidSocketInterface.prototype.harmonize = function(data, ack) {
    var target = data.target;
    if (target) {
        this.client.harmonize(target, function(result) {
            if (ack && result) {
                ack(result);
            }
        });
    }
};
AndroidSocketInterface.prototype.deharmonize = function(data, ack) {
    var result;
    if (ack) {
        ack(result);
    }
};
AndroidSocketInterface.prototype.register = function(data, ack) {
    var self = this;
    var result;
    console.log("registering...", data);
    if (this.client) {
        if (data.handler) {
            //redirect to android client
            data.handler.callable = function(value, source) {
                var params = { "id": (self.client.deviceId + data.id), "arguments": value, "source": source };
                if (self.socket) {
                    self.socket.emit("execute", params);
                }
                return true;
            };
        }
        this.client.register(data);
    }
    if (ack) {
        ack(result);
    }
};
AndroidSocketInterface.prototype.putArgument = function(data, ack) {
    var result;
    if (data && data.key && data.value) {
        this.client.putArgument(data.key, data.value);
    } else {

    }
    if (ack) {
        ack(result);
    }
};
AndroidSocketInterface.prototype.getArgument = function(data, ack) {
    var result;
    if (data && data) {
        result = this.client.getArgument(data);
    }
    if (ack) {
        ack(result);
    }
};
AndroidSocketInterface.prototype.match = function(data, ack) {

    if (ack) {
        ack();
    }
};
AndroidSocketInterface.prototype.execute = function(data, ack) {

    if (ack) {
        ack();
    }
};

AndroidSocketInterface.prototype.handleCue = function(data, ack) {
    console.log("cue", data);
    if (ack) {
        ack();
    }
};



AndroidSocketInterface.prototype.generateLocalDocuments = function() {
    if (!this.client) {
        return;
    }
    var result = {};
    for (var dType in this.client.docCache) {
        result[dType] = {};
        var docs = this.client.docCache[dType];
        for (var dId in docs) {
            var doc = docs[dId];
            if (doc.type) {
                result[dType][dId] = doc.data;
            }
        }
    }
    return result;
};