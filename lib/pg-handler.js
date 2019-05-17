'use strict';
/*jslint vars:true */
var pg = require('pg');


if (!Object.prototype.addMethod) {
    Object.prototype.addMethod = function (name, fn) {
        var old = this.prototype[name];
        this.prototype[name] = function () {
            var fncLen = fn.length,
                argLen = arguments.length;
            if (fncLen === argLen) {
                return fn.apply(this, arguments);
            } else if (typeof old === "function") {
                return old.apply(this, arguments);
            } else {
                throw new Error("no method with " + argLen + " param(s) defined!");
            }
        }
    }
}

function query_by_client(client, requests, callback) {
    if (requests.length == 0) {
        callback(null, callback.results);
        return;
    }
    var request = requests.shift();
    client.query(request['sql'], request['params'], function (err, result) {
        if (err) {
            callback(err);
        } else {
            callback.results.push(result.rows);
            query_by_client(client, requests, callback);
        }
    });
}

var PGHandler = function (config) {
    if (typeof config == 'undefined') {
        throw new Error('PGHandler constructor param config is required!!!');
    }
    this.config = config;
    this.db = new pg.Pool(config);
    this.db.on('error', function (err, client) {
        console.error(`pg.Pool error ${err.message}`);
    });
};

PGHandler.prototype.exec_sql = function (sql, param, callback) {
    if (typeof param === 'function') {
        callback = param;
        param = [];
    }
    this.db.connect(function (err, client, done) {
        if (err) {
            done();
            callback(err);
        } else {
            client.query(sql, param, function (err, result) {
                done();
                callback(err, result);
            });
        }
    });
}

PGHandler.prototype.add = function (params, callback) {
    callback(new Error('not define!'));
}

PGHandler.prototype.delete = function (params, callback) {
    callback(new Error('not define!'));
}

PGHandler.prototype.update = function (params, callback) {
    callback(new Error('not define!'));
}

/**
 * single sql query
 * @param {String} sql
 * @param {Array} params
 * @param {Function} callback
 * 
 */
PGHandler.addMethod('query', function (sql, params, callback) {
    pg.Pool.prototype.query.call(this.db, sql, params, callback);
});

/**
 *  batch query usage
 * @param {Array} requests array of sql request,eg: [{sql:'',params:[value1,value2,...]},...]
 * @param {Function} callback error priority callback,the order of results follow the param of requests
 * 
 */
PGHandler.addMethod('query', function (requests, callback) {
    this.db.connect(function (err, client, done) {
        if (err) {
            done();
            callback(err);
        } else {
            var internalCallback = function (err, results) {
                if (err) {
                    callback(err);
                } else {
                    // 取出结果
                    callback(null, results);
                }
                done();
            };
            internalCallback.results = [];
            query_by_client(client, requests, internalCallback);
        }
    });
});

PGHandler.addMethod('query', function (paramObj, queryObj, keyProperties, callback) {
    if (!paramObj) {
        callback(new Error('paramObj is not right!!!'));
        return;
    }
    if (!queryObj || !queryObj.from_command || !queryObj.field_command) {
        callback(new Error('query params is not right!!!'));
        return;
    }
    if (!keyProperties) {
        callback(new Error('query function params can not be undefined!!!'));
        return;
    }

    var sqlParamSet1 = [];
    var sqlParamSet2 = [];
    var sqlParamIndex = 1;
    // 处理过滤
    var filterSql = '';
    if (paramObj.filters && paramObj.filters.length > 0) {
        var filterArray = [];
        paramObj.filters.forEach(filter => {
            var condition = filter;
            // pay attention for sql inject 
            if (typeof keyProperties[condition['field']] == 'undefined') {
                res.status(400).end('filter key is not define');
                return;
            }
            var field = keyProperties[condition['field']].source_key ? keyProperties[condition['field']].source_key : condition['field'];
            if (condition['operate'] == 'equal') {
                filterArray.push(`${field} = $${sqlParamIndex++}`);
                sqlParamSet1.push(condition['value']);
            } else if (condition['operate'] == 'notequal') {
                filterArray.push(`${field} <> $${sqlParamIndex++}`);
                sqlParamSet1.push(condition['value']);
            } else if (condition['operate'] == 'contains') {
                filterArray.push(`${field} LIKE '%' || $${sqlParamIndex++} || '%'`);
                sqlParamSet1.push(condition['value']);
            } else if (condition['operate'] == 'less') {
                filterArray.push(`${field} < $${sqlParamIndex++}`);
                sqlParamSet1.push(condition['value']);
            } else if (condition['operate'] == 'greater') {
                filterArray.push(`${field} > $${sqlParamIndex++}`);
                sqlParamSet1.push(condition['value']);
            }
        });
        filterSql = `where ${filterArray.join(' AND ')}`
    }
    sqlParamSet2 = sqlParamSet1.slice(0);
    // 处理 分页
    var paginationSql = ` limit $${sqlParamIndex++} offset $${sqlParamIndex++}`;
    sqlParamSet1.push(parseInt(paramObj['pageSize']));
    sqlParamSet1.push((paramObj['pageIndex'] - 1) * paramObj['pageSize']);
    // 处理排序
    var orderSql = '';
    if (paramObj['sortField'] && paramObj['sortDirection']) {
        // order by field desc
        if (typeof keyProperties[paramObj['sortField']] == 'undefined') {
            res.status(400).end('filter key is not define');
            return;
        }
        var field = keyProperties[paramObj['sortField']].source_key ? keyProperties[paramObj['sortField']].source_key : paramObj['sortField'];
        if (paramObj['sortDirection'] == '1') {
            // desc
            orderSql += `ORDER BY ${field} DESC`;
        } else {
            // asc
            orderSql += `ORDER BY ${field} ASC`;
        }
    }
    var execSql = `SELECT ${queryObj.field_command} FROM ${queryObj.from_command} `;
    var countSql = `SELECT count(1) as total FROM ${queryObj.from_command} `;
    if (orderSql) {
        execSql = execSql.replace('SELECT', `SELECT ROW_NUMBER () OVER (${orderSql}) AS number,`) + filterSql + ' ' + orderSql + ' ' + paginationSql;
    } else {
        execSql = execSql + filterSql + ' ' + paginationSql;
    }
    countSql = countSql + filterSql;
    // console.log('countSql', countSql)
    var requests = [
        {
            sql: countSql,
            params: sqlParamSet2
        },
        {
            sql: execSql,
            params: sqlParamSet1
        }
    ]
    // console.log(requests);
    this.query(requests, function (err, result) {
        if (err) {
            callback(err, result);
        } else {
            var result = {
                items: result[1],
                sum: {},
                totalCount: result[0][0].total
            }
            callback(undefined, result);
        }
    });
});

module.exports = PGHandler;
