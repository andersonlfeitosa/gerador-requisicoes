var http = require("http");
var request = require('sync-request');
var fs = require("fs");
var cpf_cnpj = require("cpf_cnpj").CPF;

var headers = {
  'Content-Type': 'application/json',
  'Authorization' : 'Basic c3U6Z3c='
  //'Authorization': 'Basic cHU6cGFzc3dvcmQ=',
  //'UserToken': 'aarmstrong',
  //'Granted-Authorities': '{"id":"pravin","username":"aarmstrong","securityRealm":{"id":"pravin","realm":"default"},"grantedAuthorities":[{"id":"pravin","target":"510011410000008","authorityType":"POLICY"}]}'
};

var NUMREQ_DEFAULT = 50;
var AVG = 0;
var MAX = 0;
var MIN = 9999999;
var NUM_POL = 0;
var ASYNC_REQ = 0;

var type = process.argv[2] || "life";
var file = type + '.json';
var NUMREQ = process.argv[3] || NUMREQ_DEFAULT;
var mode = process.argv[4] || "sync"

var month = new Date().getMonth() + 1;
if (month < 10) {
  month = '0' + month;
}
var periodStartDate = '2016-' + month + '-' + new Date().getDate() + 'T16:13:35.720-03:00';

fs.readFile(file, (err, data) => {
  var json = JSON.parse(data);

  for (var i = 0; i < NUMREQ; i++) {
    var item = cpf_cnpj.generate(true);

    json.params[0].draftData.accountHolder.taxID = item;
    json.params[0].draftData.periodStartDate = periodStartDate;

    if (type == "life") {
      json.params[0].draftData.lobs.aAHAandH.aandHPartys[0].coveredPerson.taxID = item;
    } else if (type == "home") {
      json.params[0].draftData.lobs.homeowners.additionalInterests_GCS[0].contact.taxID = cpf_cnpj.generate(true);
    } else if (type == "auto") {
      json.params[0].draftData.lobs.personalAuto.drivers[0].person.taxID = item;
    }

    headers['Content-Length'] = Buffer.byteLength(JSON.stringify(json), 'utf8');

    if (mode == "sync") {
      doSync(json);
    } else if (mode == "async") {
      doAsync(json);
    }
  };

  if (mode == "sync") {
    console.log("REQS: %s - POLICIES: %s - MIN: %s - MAX: %s - AVG: %s",  NUMREQ, NUM_POL, MIN, MAX, AVG / NUMREQ);
  }

});

function doSync(json) {
  var startTime = new Date().getTime();

  //10.102.2.166
  //var res = request('POST', 'http://10.101.2.34:9080/pc/service/edge/quote/quote', {
  var res = request('POST', 'http://guidewireuat.caixaseguros.intranet/pc/service/edge/quote/quote', {
      headers : headers, json : json
  });

  var finalTime = new Date().getTime() - startTime;

  if (finalTime < MIN) {
    MIN = finalTime;
  }
  if (finalTime > MAX) {
    MAX = finalTime;
  }

  AVG += finalTime;

  var policy = JSON.parse(res.getBody());
  if (policy.result.bindData.policyNumber != null) {
    NUM_POL++;
  }

  console.log(finalTime);
};

function doAsync(jsonObject) {
  var optionspost = {
    host :  'guidewireuat.caixaseguros.intranet', 
    path : '/pc/service/edge/quote/quote',
    method : 'POST',
    headers : headers
  };

  var startTime = new Date().getTime();
  var request = http.request(optionspost,  function(response) {
    var str = '';

    response.on('data', function (chunk) {
      str += chunk;
    });

    response.on('end', function () {
      var policy = JSON.parse(str);
      
      var finalTime = new Date().getTime() - startTime;
      if (finalTime < MIN) {
        MIN = finalTime;
      }
      if (finalTime > MAX) {
        MAX = finalTime;
      }

      AVG += finalTime;

      if (policy.result.bindData.policyNumber != null) {
        NUM_POL++;
      }

      console.log(finalTime);
      ASYNC_REQ++;
      if (ASYNC_REQ == NUMREQ) {
        console.log("REQS: %s - POLICIES: %s - MIN: %s - MAX: %s - AVG: %s",  NUMREQ, NUM_POL, MIN, MAX, AVG / NUMREQ);
      }
    });
  });

  request.write(JSON.stringify(jsonObject));

  request.end();
};


