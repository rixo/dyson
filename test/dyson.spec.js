var dyson = require('../lib/dyson'),
    request = require('supertest'),
    express = require('express'),
    sinon = require('sinon');

describe('dyson', function() {

    var options = {};

    describe('.services', function() {

        var expressRouter;

        var app;

        before(function() {

            expressRouter = express.Router;

            express.Router = function() {
                return app;
            }

        });

        after(function() {

            express.Router = expressRouter;

        });

        beforeEach(function() {

            app = {
                get: sinon.spy(),
                post: sinon.spy(),
                use: sinon.spy(),
                options: sinon.spy()
            };

        });

        it('should add GET route to Router', function() {

            var config = {
                get: [
                    {
                        path: '/endpoint',
                        callback: function() {},
                        render: function() {}
                    }
                ]
            };

            dyson.services(options, config);

            app.get.callCount.should.equal(1);
            app.get.firstCall.args[0].should.equal(config.get[0].path);
            app.get.firstCall.args.should.containEql(config.get[0].callback);
            app.get.firstCall.args.should.containEql(config.get[0].render);

        });

        it('should add POST route to Router', function() {

            var config = {
                post: [
                    {
                        path: '/endpoint',
                        callback: function() {},
                        render: function() {}
                    }
                ]
            };

            dyson.services(options, config);

            app.post.callCount.should.equal(1);
            app.post.firstCall.args[0].should.equal(config.post[0].path);
            app.post.firstCall.args.should.containEql(config.post[0].callback);
            app.post.firstCall.args.should.containEql(config.post[0].render);

        });
    });

    describe('routes', function() {

        var app;

        var express = require('express');

        before(function() {

            var render = function(req, res) {
                res.status(200).send(res.body)
            };

            var configs = {
                get: [
                    {
                        path: '/user/:id',
                        template: {
                            id: function(params) {
                                return params.id;
                            },
                            name: 'John'
                        },
                        callback: function(req, res, next) {
                            var template = configs.get[0].template;
                            res.body = {
                                id: template.id(req.params),
                                name: template.name
                            };
                            next();
                        },
                        render: render
                    }
                ],
                post: [
                    {
                        path: '/user',
                        callback: function(req, res, next) {
                            res.body = {saved: true};
                            next();
                        },
                        render: render
                    }
                ]
            };

            app = express()
              .use(dyson.services(options, configs));

        });

        it('should respond with body based on template and custom callback', function(done) {

            request(app).get('/user/1').expect(200, {"id": 1, "name": "John"}, done);

        });

        it('should respond with body based on callback', function(done) {

            request(app).post('/user').expect(200, {"saved": true}, done);

        });
    });
});
