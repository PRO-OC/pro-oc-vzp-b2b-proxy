var express = require('express');
var request = require('request');
var app = express();
var fs = require("fs");
var CryptoJS = require("crypto-js");

app.use(express.text());

var cert = fs.readFileSync("cert.pem");
var certPass = process.env.CERT_PASS;
var encryptKey = process.env.ENCRYPT_KEY;

var targetURL = 'https://prod.b2b.vzp.cz';

function encryptBody(body, key) {
    let encJson = CryptoJS.AES.encrypt(JSON.stringify( { body }), key).toString();
    let encData = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encJson));
    return encData;
}

function decryptBody(body, key) {
    let decData = CryptoJS.enc.Base64.parse(body).toString(CryptoJS.enc.Utf8);
    let bytes = CryptoJS.AES.decrypt(decData, key).toString(CryptoJS.enc.Utf8);
    return JSON.parse(bytes).body;
}

app.all('*', function (req, res, next) {

    console.log(req.method + ': new request');

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type', 'X-Requested-With');

    if (req.method === 'OPTIONS') {
        console.log('OPTIONS: preflight sent');
        res.send();
    } else if (req.method === "GET") {

        return new Promise(resolve => {
            request({ url: targetURL + req.url, method: req.method, headers: {'Content-Type': 'text/xml'}, agentOptions: { cert: cert, key: cert, passphrase: certPass, securityOptions: 'SSL_OP_NO_SSLv3' } },
                function (error, response, body) {
                    if (!error) {
                        resolve(body);
                    }
                }
            );
        }).then(body => {
            console.log('GET: response sent');
            res.send(body);
        });
    } else if (req.method === "POST") {

        return new Promise(resolve => {

            const bodyDecrypted = decryptBody(req.body, encryptKey);
            request({ url: targetURL + req.url, method: req.method, headers: {'Content-Type': 'text/xml'}, body: bodyDecrypted, agentOptions: { cert: cert, key: cert, passphrase: certPass, securityOptions: 'SSL_OP_NO_SSLv3' } },
                function (error, response, body) {
                    if (!error) {
                        console.log('POST error:', error);
                        console.log('POST response:', response);
                        console.log('POST body:', body);
                        resolve(body);
                    } else {
                        console.log('ERROR: ' + error);
                    }
                }
            );
        }).then(body => {
            console.log('POST: response sent');
            var bodyEncrypted = encryptBody(body, encryptKey);
            res.send(bodyEncrypted);
        });
    } else {
        console.log(req.method + ': is not POST, GET or OPTION request');
        next();
    }
});

app.set('port', process.env.PORT || 3000);

app.listen(app.get('port'), function () {
    console.log('Proxy server listening on port ' + app.get('port'));
});
