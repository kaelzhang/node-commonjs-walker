module.exports = LoaderContext;

function LoaderContext(){
    this._dependencies = [];
}

LoaderContext.prototype.getDependencies = function(){
    return this._dependencies;
};

LoaderContext.prototype.addDependency = function(dep){
    this._dependencies.push(dep);
}

LoaderContext.prototype.run = function(options, callback){
    var context = this;
    var isSync = true;
    var isDone = false;
    var isError = false;
    var reportedError = false;

    context.resourcePath = options.path;
    context.source = options.source;
    context.loaderFn = options.loaderFn;


    context.async = function(){
        if(isDone) {
            if(reportedError) return; // ignore
            throw new Error("async(): The callback was already called.");
        }
        isAsync = false;
        return context.callback;
    }

    context.callback = function(){
        if(isDone) {
            if(reportedError) return; // ignore
            throw new Error("callback(): The callback was already called.");
        }

        isDone = true;
        isSync = false;
        try {
            callback.apply(null, arguments);
        } catch(e) {
            isError = true;
            throw e;
        }
    }


    try {
        var result = (function() { return context.loaderFn.apply(context, [context.source]) }());
        if(isSync){
            callback(null, result);
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
        callback(e);
    }

};
