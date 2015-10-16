var multiRequest = require('./multiRequest'),
    util = require('./util'),
    _ = require('lodash'),
    when = require('when');

var cache = {};

var generate = function(req, res, next) {

    // @todo rixo test exposeRequest
    var service = this,
        exposeRequest = service.exposeRequest !== false
            && (service.exposeRequest || util.options.exposeRequest),
        path = req.url,
        overrides = req.overrides;

    var templateArgs = exposeRequest
        ? [req]
        : [req.params, req.query, req.body, req.cookies, req.headers];

    // @todo rixo test container receives resolved data
    var containerArgs = exposeRequest
        ? [req]
        : [req.params, req.query, req.data];

    if(_.isFunction(service.status)) {
        service.status.apply(service, arguments);
    }

    function setValuesWithResolved(scope) {
        if (overridePromise) {
            return overridePromise.then(function(data) {
                template = applyOverrides(template, data);
                templateArgs.push(data);
                containerArgs.push(data);
                return setValues(template, templateArgs, scope);
            });
        } else {
            templateArgs.push(template);
            containerArgs.push(template);
            return setValues(template, templateArgs, scope);
        }
    }

    if(!(service.cache && cache[path])) {

        if(!multiRequest.isMultiRequest(path)) {

            var isCollection = _.isFunction(service.collection) ? service.collection.apply(service, templateArgs) : service.collection,
                template = _.isFunction(service.template) ? service.template.apply(service, templateArgs) : service.template,
                promise;

            if (overrides) {
                var overridePromise = setValues(mergeOverrides(overrides), templateArgs);
            }

            if(!isCollection) {

                promise = setValuesWithResolved();

            } else {

                var size = _.isFunction(service.size) ? service.size.apply(service, templateArgs) : service.size;

                promise = when.map(_.times(parseInt(size, 10)), function() {
                    return setValuesWithResolved();
                });
            }

            promise.then(function(data) {
                return !service.container ? data : setValues(_.result(service, 'container'), containerArgs, service);
            }).then(function(data) {
                res.body = cache[path] = data;
                util.log('Resolving response for', req.method, path);
                next();
            });

        } else {

            when.all(multiRequest.doMultiRequest(req, path)).then(function(data) {

                res.body = cache[path] = data;

                util.log('Resolving response for:', req.method, path, '(multiRequest)');

                next();

            });
        }

    } else {

        util.log('Resolving response for', req.method, path, '(cached)');

        res.body = cache[path];

        next();

    }
};

function mergeOverrides(overrides) {
    return overrides.reduce(function(flatten, override) {
        return _.extend(flatten, override);
    }, {});
}

function applyOverrides(template, override) {
    var overrideKeys = Object.keys(override);
    var tmp = {};
    _.forOwn(template, function(value, key) {
        if (override[key]) {
            tmp[key] = override[key];
            var keyIndex = overrideKeys.indexOf(key);
            if (keyIndex !== -1) {
                overrideKeys.splice(keyIndex, 1);
            }
        } else {
            tmp[key] = value;
        }
    });
    overrideKeys.forEach(function(key) {
        tmp[key] = override[key];
    });
    return tmp;
}

var setValues = function(template, params, scope) {

    template = template || null;

    return when.promise(function(resolve, reject, notify) {

        var promises = [],
            obj = _.isArray(template) ? [] : Object.create(template);

        _.forEach(template, function(value, key) {
            if(template.hasOwnProperty(key)) {
                obj[key] = _.isFunction(value) ? value.apply(scope || obj, params) : _.isPlainObject(value) ? setValues(value, params, obj) : value;

                if(when.isPromiseLike(obj[key])) {
                    promises.push(obj[key]);
                    obj[key].then(function(key, value) {
                        obj[key] = value;
                    }.bind(obj, key));
                }
            }
        });

        when.all(promises).then(function() {
            resolve(obj);
        });

    });
};

var render = function(req, res) {
    res.send(res.body);
};

module.exports = {
    generate: generate,
    render: render,
    // Only export for unit tests
    setValues: util.isTest() ? setValues : undefined
};
