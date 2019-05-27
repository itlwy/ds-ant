var path = require('path');
var bodyParser = require('body-parser');
var DS_File = require(path.join(__dirname, 'ds-file'));
var DS_Field = require(path.join(__dirname, 'ds-field'));

var DS_Dispatcher = function (config) {
    if (!config || typeof config != 'object') {
        throw new Error('constructed function param must offer express app instance!!!');
    }
    this.config = config;
    this.DS_File = new DS_File({
        inject_handler: config.inject_handler,
    });
    this.DS_Field = new DS_Field();
    this.middleware_queue = [];
    this.start();
}

DS_Dispatcher.prototype.start = function () {
    var urlencodedParser = bodyParser.urlencoded({ extended: false });
    this.use(bodyParser.json());
    this.use(urlencodedParser);

    var api_prefix = this.config.api_prefix;
    this.api_prefix = api_prefix ? path.join(api_prefix, '/') : '/api/datasource/';
}

// 加载请求处理的中间件
DS_Dispatcher.prototype.use = function (middle_func) {
    this.middleware_queue.unshift(middle_func);
};

DS_Dispatcher.prototype.on_request = function (req, res, next) {
    var api_path = req.path;
    var method = req.method;
    // if (api_path.startsWith('/api/datasource')) {
    var ds_path = api_path.replace(this.api_prefix, '');
    var DS_File = this.DS_File;
    if (DS_File.path2desc[ds_path]) {
        var ds_obj = DS_File.path2desc[ds_path];
        var dataSource = DS_File.name2ds[ds_obj['source']];
        if (!dataSource) {
            res.status(500).end();
            console.error(`dataSource not found , apiPath:${api_path}`);
            return;
        }
        var func = this['on_' + method];
        if (func) {
            func.call(this, dataSource, ds_obj, req, res);
        } else {
            var msg = 'not a support datasource method';
            console.error(msg);
            res.status(400).end(msg)
        }
    } else {
        res.status(405).end();
    }
};

DS_Dispatcher.prototype.on_POST = function (dataSource, ds_obj, req, res) {
    if (req.body.length === 0) {
        res.status(400).end('the param is not correct!!!');
        return;
    }
    var exec_obj;
    if (ds_obj.add && typeof ds_obj.add === 'function') {
        exec_obj = ds_obj.add;
    } else {
        exec_obj = dataSource.add;
    }
    if (this.DS_Field.validateField(ds_obj.field_properties, req.body, res)) {
        exec_obj && exec_obj(dataSource.db, req.body, function (error, result) {
            if (error) {
                console.error(error);
                res.status(500).end();
            } else {
                res.end(JSON.stringify(result));
            }
        });
    }

};

DS_Dispatcher.prototype.on_DELETE = function (dataSource, ds_obj, req, res) {
    var id = req.query.id;
    if (typeof id == 'undefined') {
        res.status(400).end('the param is not correct!!!');
        return;
    }
    var exec_obj;
    if (ds_obj.delete && typeof ds_obj.delete === 'function') {
        exec_obj = ds_obj.delete;
    } else {
        exec_obj = dataSource.delete;
    }
    exec_obj && exec_obj(dataSource.db, req.query, function (error, result) {
        if (error) {
            console.error(error);
            res.status(500).end();
        } else {
            res.end(JSON.stringify(result));
        }
    });
};

DS_Dispatcher.prototype.on_PUT = function (dataSource, ds_obj, req, res) {
    if (req.body.length === 0) {
        res.status(400).end('the param is not correct!!!');
        return;
    }
    var exec_obj;
    if (ds_obj.update && typeof ds_obj.update === 'function') {
        exec_obj = ds_obj.update;
    } else {
        exec_obj = dataSource.update;
    }
    if (this.DS_Field.validateField(ds_obj.field_properties, req.body, res)) {
        exec_obj && exec_obj(dataSource.db, req.body, function (error, result) {
            if (error) {
                console.error(error);
                res.status(500).end();
            } else {
                res.end(JSON.stringify(result));
            }
        });
    }
};

DS_Dispatcher.prototype.on_GET = function (dataSource, ds_obj, req, res) {
    var paramJson = req.query.json;
    // console.log('paramJson :', paramJson);
    if (typeof paramJson == 'undefined') {
        res.status(400).end('the param is not correct!!!');
        return;
    }
    paramJson = JSON.parse(paramJson);
    this.DS_Field.validateOperator(paramJson, ds_obj, res)
        && dataSource.query
        && dataSource.query(paramJson, ds_obj.query, ds_obj.field_properties, function (error, result) {
            if (ds_obj.callback && typeof ds_obj.callback == 'function') {
                ds_obj.callback(error, req, res, result);
                return;
            }
            if (error) {
                console.error(error);
                res.status(500).end();
            } else {
                res.end(JSON.stringify(result));
            }
        });
};

DS_Dispatcher.prototype.recursiveMiddleWare = function (queue, req, res, next) {
    var middle_func = queue.shift();
    if (middle_func) {
        middle_func(req, res, function () {
            this.recursiveMiddleWare(queue, req, res, next);
        }.bind(this));
    } else {
        next();
    }
};


module.exports = {
    init: function (config) {
        var dispatcher = new DS_Dispatcher(config);
        var func = function (req, res, next) {
            var api_path = req.path;
            if (api_path.startsWith(path.join(this.api_prefix, '/'))) {
                this.recursiveMiddleWare(this.middleware_queue.slice(0), req, res, function () {
                    this.on_request(req, res, next);
                }.bind(this));
            } else {
                next();
            }
        }.bind(dispatcher);
        func.DS_File = dispatcher.DS_File;
        return func;
    }
}