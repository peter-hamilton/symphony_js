var deepDiffMapper = module.exports =  function() {
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
                                ld: obj1,
                                li: obj2,
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
                unchanged.push(key);
                if (!op || !op.length) {
                    continue;
                }

                //HACK!!!!!!!!!!!!!!!!!!!!!!!11
                if (!op.p || !('tones' in op.p)) {
                    ops = ops.concat(op);
                }
            }


            for (var key in obj2) {
                if (!isNaN(key)) key = parseInt(key);

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
                if (!op || !op.length) {
                    continue;
                }
                //HACK!!!!!!!!!!!!!!!!!!!!!!!11
                if (!op.p || !('tones' in op.p)) {
                    ops = ops.concat(op);
                }
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