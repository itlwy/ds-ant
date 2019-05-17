

var DS_Field = function (config) {

};

DS_Field.prototype.validateField = function (field_properties, data_obj, res) {
    for (var key in field_properties) {
        var rules = field_properties[key]['rules'];
        if (rules && Array.isArray(rules) && rules.length > 0) {
            var need_check_value = data_obj[key];
            if (typeof need_check_value === 'string') {
                for (var index = 0; index < rules.length; index++) {
                    var item = rules[index];
                    var reg = new RegExp(item.rule);
                    if (!reg.test(need_check_value)) {
                        res.status(400).end(JSON.stringify({
                            message: `param:${key},${item.message ? item.message : ' not match!'}`
                        }));
                        return false;
                    }
                }
            }
        }
    }
    return true;
};

DS_Field.prototype.validateOperator = function (param_json, ds_obj,res) {
    if (ds_obj.field_properties && param_json.filters && Array.isArray(param_json.filters) && param_json.filters.length > 0) {
        // check black list
        for (var index = 0; index < param_json.filters.length; index++) {
            var filter = param_json.filters[index];
            var key = filter.field;
            var blacklist = ds_obj.field_properties[key] ? ds_obj.field_properties[key]['operator_blacklist'] : undefined;
            if (blacklist && blacklist.length > 0 && blacklist.indexOf(filter.operate) > -1) {
                res.status(400).end(JSON.stringify({
                    message: 'unauthorized query!'
                }));
                return false;
            }
        }
    }
    return true;
};

module.exports = DS_Field;