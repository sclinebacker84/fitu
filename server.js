var express = require('express')
var fs = require('fs')
var https = require('https')
var app = express()

app.use(express.static(__dirname+'/static'))

https.createServer({
  key: fs.readFileSync(__dirname+'/certs/server.key'),
  cert: fs.readFileSync(__dirname+'/certs/server.crt'),
  ca: [fs.readFileSync(__dirname+'/certs/ca.crt')]
}, app)
.listen(3000, function () {
  console.log('Example app listening on port 3000! Go to https://localhost:3000/')
})