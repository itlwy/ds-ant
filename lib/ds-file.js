var path = require('path');
var fs = require('fs');
var fs_util = require('./utils/file-util');

var isExecutable = function (filename) {
    if (/[wW]in.*/.test(process.platform)) { return true; };
    try {
        var stat = fs.statSync(filename);
        var mode = parseInt((stat.mode & parseInt("777", 8)).toString(8)[0]);
    } catch (error) {
        return false;
    }
    return mode & 1;
}

var DS_File = function (config) {
    this.config = config;
    this.name2ds = {};
    this.path2desc = {};
    this.ds_handler_map = {};
    this.inject_handler = config.inject_handler;
    this.start();
};

DS_File.prototype.start = function () {
    if (this.inject_handler) {
        var handler_array = this.inject_handler();
        if (Array.isArray(handler_array)) {
            handler_array.forEach(function (handler) {
                this.addHandler(handler['type'], handler['handler']);
            }.bind(this));
        }
    }
    var root = this.config.root ? this.config.root : path.resolve('./datasource');
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root);
    }
    this.desc_path = path.join(root, 'description');
    this.source_path = path.join(root, 'source');
    this.load_dataSource(this.source_path);
    this.load_desc_resource(this.desc_path);

    this.init_watcher();
}

DS_File.prototype.addHandler = function (type, handler) {
    this.ds_handler_map[type] = handler;
};

// 加载资源描述列表
DS_File.prototype.load_desc_resource = function (dir_path) {
    !fs.existsSync(dir_path) && fs_util.mkdirsSync(dir_path);
    var files = fs.readdirSync(dir_path);
    for (let index = 0; index < files.length; index++) {
        var file = files[index];
        if (fs.statSync(path.join(dir_path, file)).isDirectory()) {
            this.load_desc_resource(path.join(dir_path, file));
        } else {
            if (/^.*\.js$/.test(file) && isExecutable(path.join(dir_path, file))) {
                var absolute_path = path.join(dir_path, file).replace('.js', '');
                this.path2desc[absolute_path.replace(this.desc_path + '/', '')] = require(absolute_path);
            }
        }
    }
};
// 加载ds数据源
DS_File.prototype.load_dataSource = function (dir_path) {
    !fs.existsSync(dir_path) && fs_util.mkdirsSync(dir_path);
    var ds_files = fs.readdirSync(dir_path);
    for (let index = 0; index < ds_files.length; index++) {
        var ds_file = ds_files[index];
        if (/^.*\.js$/.test(ds_file) && isExecutable(path.join(dir_path, ds_file))) {
            var config = require(path.join(dir_path, ds_file));
            if (this.ds_handler_map[config.type]) {
                var DS_Handler = this.ds_handler_map[config.type];
                this.name2ds[config.key] = new DS_Handler(config.connection);
            } else {
                console.error('can not match ds_handler for file :' + path.join(dir_path, ds_file));
            }
        }
    }
};

DS_File.prototype.init_watcher = function () {
    fs.watch(this.source_path,
        { persistent: true, recursive: false }, function (eventType, filename) {
            this.load_dataSource(this.source_path);
        }.bind(this));
    fs.watch(this.desc_path,
        { persistent: true, recursive: true }, function (eventType, filename) {
            this.load_desc_resource(this.desc_path);
        }.bind(this));
};

module.exports = DS_File;