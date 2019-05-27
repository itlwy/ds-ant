var path = require('path');
var app = require('express')();
var ds_dispatcher = require('../lib/ds-dispatcher');

var dispatcher = ds_dispatcher.init({
    api_prefix: '/api/datasource',
    root: path.resolve('./datasource'),
    inject_handler: function () {
        var PG_Handler = require(path.join(__dirname, '../lib/pg-handler'));
        return [
            {
                type: 'pg',
                handler: PG_Handler
            }
        ]
    }
});
app.use(dispatcher);

app.listen(3000);
