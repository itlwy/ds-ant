module.exports = {
    key:'db',
    type: 'pg',    // 数据源类型，eg: pg mssql filesystem
    connection: {
        database: 'cms',
        host: "/var/run/postgresql",
        port: 5432,
        user: process.env.USER || "root"
    }
}