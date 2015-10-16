var path = require('path'),
    express = require('express'),
    favicon = require('serve-favicon'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    cors = require('cors'),
    loader = require('./loader'),
    defaults = require('./defaults'),
    proxy = require('./proxy'),
    util = require('./util'),
    requireParameter = require('./parameter');

/*
 * There are roughly 4 steps to initialize dyson:
 *
 * 1. Load raw configurations
 * 2. Mix defaults into raw configurations
 * 3. Initialize Express server
 * 4. Register configured services with Express
 */

var bootstrap = function(options) {

    util.options.set(options);

    var rawConfigs = loader.load(options.configDir);

    var configs = defaults.assignToAll(rawConfigs);

    var app = initExpress(options.port);

    registerServices(app, options, configs);

};

var initExpress = function(port) {

    var app = express();

    app.listen(port);

    return app;
};

// Register middleware to Express as service for each config (as in: `app.get(config.path, config.callback);`)

var registerServices = function(app, options, configs) {
    
    var middleware = express();
    var corsHandler = cors({origin: true, credentials: true});
    middleware.use(favicon(__dirname + '/favicon.ico'));
    middleware.use(bodyParser.json());
    middleware.use(bodyParser.urlencoded({ extended: true }));
    middleware.use(cookieParser());
    middleware.use(corsHandler);

    var stack = [];

    for(var method in configs) {
        if (configs.hasOwnProperty(method)) {
            configs[method].forEach(function(config) {
                if(options.proxy === true && config.proxy !== false) {
                    // Allows each config file to be bypassed without removing it
                    util.log('Proxying', method.toUpperCase(), 'service at', config.path);
                } else {
                    util.log('Registering', method.toUpperCase(), 'service at', config.path);
                    var handler = function(req, res, next) {
                        if (!config.match || config.match.call(config, req)) {
                            if (config.override) {
                                // store overrides and let it flow to the root route
                                req.overrides = req.overrides || [];
                                req.overrides.push(config.override);
                                next('route');
                            } else {
                                // process this config
                                requireParameter.call(config, req, res, next);
                            }
                        } else {
                            // no match, ignore this config
                            next('route');
                        }
                    };
                    var args = [method, config.path, middleware, handler, config.callback, config.render];
                    // Config that always match (i.e. that don't have a match function)
                    // should be tested last
                    stack[config.match ? 'unshift' : 'push'](args);
                }
            });
        }
    }

    stack.forEach(function(args) {
        var method = args.shift(),
            path = args[0];
        app[method].apply(app, args);
        app.options(path, corsHandler);
    });

    if(options.proxy) {

        app.all('*', proxy.middleware);

    } else {

        !util.isTest() && app.all('*', function(req, res, next) {
            util.error('404 NOT FOUND:', req.url);
            res.writeHead(404);
            res.end();
        });
    }
};

module.exports = {
    bootstrap: bootstrap,
    util: util,
    // Only export for unit tests
    initExpress: util.isTest() ? initExpress : undefined,
    registerServices: util.isTest() ? registerServices : undefined
};
