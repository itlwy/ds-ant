'use strict';
/*jslint vars:true */

module.exports = {
    source: 'db',
    field_properties: {
        "id": {
            rules: [] // field正则校验
        },
        "name": {
        },
        "model": {
            operator_blacklist: ['contains'],
            source_key: "meta->>'model'",
            rules: [
                {
                    rule: '^cn\\d{1,4}$',
                    message: '必需为cn开头加1-4位数字'
                }
            ],
        },
        "create_time": {
            source_key: "t_create"
        },
    },
    query: {
        from_command: 'student',
        field_command: `id,to_char(t_create,'YYYY-MM-DD HH24:MI:SS') as create_time
                        ,meta->'name' as name`,
        // callback: function (err,req, res, result) {

        // }
    },
    /*
        params : {
                <field1-key> : <field1-value>,
                ...
            }
     */
    add: function (db, params, callback) {
        // console.log(`add was call,param:`, params);
        var id = 'COWN-VVV-ZZ-' + Math.floor(Math.random() * 1000);
        var sql = 'insert into student (id, name, meta) values ($1, $2, $3)';
        sql = sql + 'on conflict (id) do update set meta=excluded.meta';
        var sql_params = [
            id,
            'default',
            {
                tid: id,
                name: params['name']
            }
        ];
        db.query(sql, sql_params, function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(undefined, { id })
            }
        });
        // response data : { <unique-key>  : <value>}
    },
    /*
        params: {
            <unique-key> : <value>
        }
     */
    delete: function (db, params, callback) {
        console.log(`delete was call,param:`, params);
        var sql = `delete from student where id = $1`;
        // console.log(`delete  sql:${sql},param:${params['id']}`)
        db.query(sql, [params['id']], function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(undefined, { id: params['id'] })
            }
        });
        // response data : { <unique-key>  : <value>}
    },
    /**
     * 
     * @param {*} params    
     * { <unique-key> : <value>, 
     *   <field1-key> : <field1-value>,
     *   ...
     * }
     * @param {*} callback 
     */
    update: function (db, params, callback) {
        // console.log(`update was call,param:`, params);
        var sql = `update student set meta = $1
                    where id = $2`;
        var sql_params = [
            {
                name: params['name']
            },
            params['id']
        ];
        db.query(sql, sql_params, function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(undefined, { id: params['id'] })
            }
        });
        // response data : { <unique-key>  : <value>}
    }
};
