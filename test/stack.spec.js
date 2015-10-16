var dyson = require('../lib/dyson'),
    defaults = require('../lib/defaults'),
    request = require('supertest'),
    express = require('express'),
    sinon = require('sinon');

describe('dyson route stack', function() {

    var app = express(),
        options = {};

    before(function() {
        var rawConfigs = {
            get: [
                {
                    path: '/endpoint/:id?',
                    template: {
                        id: function(params) {
                            return '/' + (params.id || 1);
                        },
                        ownProp: 'mine',
                        otherProp: 'override me!'
                    }
                },
                {
                    path: '/endpoint/:id',
                    match: function(req) {
                        return req.params.id == 2;
                    },
                    template: {
                        id: 2
                    }
                },
                {
                    path: '/endpoint/:name',
                    match: function(req) {
                        return req.params.name == 'foo';
                    },
                    template: {
                        id: 'foo'
                    }
                },
                {
                    path: '/endpoint/:id',
                    match: function(req) {
                        return req.params.id === 'override';
                    },
                    override: {
                        id: 'override',
                        otherProp: 'overridden!'
                    }
                },
                {
                    path: '/resolve/:id',
                    exposeRequest: true,
                    template: {
                        value: 'root',
                        depending: function(req, resolved) {
                            return ':' + resolved.value;
                        },
                        nested: {
                            value: function(req, resolved) {
                                return '::' + resolved.value;
                            }
                        }
                    }
                }, {
                    path: '/resolve/:id',
                    match: function(req) {
                        return req.params.id === 'child';
                    },
                    override: {
                        value: 'child'
                    }
                }
            ]
        };

        var configs = defaults.assignToAll(rawConfigs);

        dyson.registerServices(app, options, configs);
    });

    it('should respond with the route config with no match function if none other matches', function(done) {
        var expected = {"id": '/3', "ownProp": "mine", "otherProp": "override me!"};
        request(app).get('/endpoint/3').expect(200, expected, done);
    });

    it('should respond with the route config that first match', function(done) {
        request(app).get('/endpoint/2').expect(200, {"id": 2}, done);
    });

    it('should match a config even if param structure is not the same', function(done) {
        request(app).get('/endpoint/foo').expect(200, {"id": 'foo'}, done);
    });

    it('should override base values when an override object is present', function(done) {
        var expected = {"id": 'override', "ownProp": "mine", "otherProp": "overridden!"};
        request(app).get('/endpoint/override').expect(200, expected, done);
    });

    it('should expose resolved overrides to following routes', function(done) {
        var expected = {"value": 'child', "depending": ":child", "nested": {"value": "::child"}};
        request(app).get('/resolve/child').expect(200, expected, done);
    });

    it('should not expose resolved overrides if the child route does not match', function(done) {
        var expected = {"value": 'root', "depending": ":root", "nested": {"value": "::root"}};
        request(app).get('/resolve/root').expect(200, expected, done);
    });
});
