var async = require('async');
var _ = require('underscore');

module.exports = LoaderContext;


function LoaderContext(){
    this._dependencies = [];
}

LoaderContext.prototype.getDependencies = function(){
    return this._dependencies;
};

LoaderContext.prototype.addDependency = function(dep){
    this._dependencies.push(dep);
};

LoaderContext.prototype.run = function(options, callback){
    var loaderCtx = this;

    loaderCtx.resource = options.resource;
    loaderCtx.resourcePath = options.resourcePath;
    loaderCtx.resourceQuery = options.resourceQuery;
    loaderCtx.source = options.source;
    loaderCtx.loaderFn = options.loaderFn;
    loaderCtx.context = options.context;
    loaderCtx.options = {};
    loaderCtx.loaderIndex = 0;
    loaderCtx.loaders = options.loaders;

    function runSyncOrAsync(source, fn, cb){
        function done(err, result){
            cb(err, result);
        }
        var result;
        var isSync = true;
        var isDone = false;
        var isError = false;
        var reportedError = false;
        var ctx = _.extend({}, loaderCtx);
        ctx.async = function(){
            if(isDone) {
                if(reportedError) return; // ignore
                throw new Error("async(): The callback was already called.");
            }
            isSync = false;
            return ctx.callback;
        };

        ctx.callback = function(){
            if(isDone) {
                if(reportedError) return; // ignore
                throw new Error("callback(): The callback was already called.");
            }

            isDone = true;
            isSync = false;
            try {
                done.apply(null, arguments);
            } catch(e) {
                isError = true;
                throw e;
            }
        };

        try {
            result = fn.apply(ctx, [source]);
            if(isSync){
                done(null, result);
            }
        } catch(e) {
            if(isError) throw e;
            if(isDone) {
                // loader is already "done", so we cannot use the callback function
                // for better debugging we print the error on the console
                if(typeof e === "object" && e.stack) console.error(e.stack);
                else console.error(e);
                return;
            }
            isDone = true;
            reportedError = true;
            done(e);
        }
    }

    var source = loaderCtx.source;
    var tasks = loaderCtx.loaderFn.map(function(fn, i){
        if(i == 0){
            return function(done){
                runSyncOrAsync(source, fn, done);
            }
        }else{
            return function(source, done){
                runSyncOrAsync(source, fn, done);
            };
        }
    });

    async.waterfall(tasks, function(err, result){
        callback(err, result);
    });
};
