/*!
 * test-get
 * Copyright(c) 2018-2019 lwy
 * MIT Licensed
 */


const http = require('http');

const base_url = 'http://localhost:3000/api/datasource/';
let json_param = JSON.stringify({
    "pageIndex": 1,
    "pageSize": 5,
    "sortField": "create_time",
    "sortDirection": 1,
    "filters": [],
    "sumFields": []
});
const get_url = base_url + `a1/ds1?json=${json_param}`;
http.get(get_url, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let error;
    if (statusCode !== 200) {
        error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
    }
    if (error) {
        console.error(error.message);
        // consume response data to free up memory
        res.resume();
        return;
    }

    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log(parsedData);
        } catch (e) {
            console.error(e.message);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});