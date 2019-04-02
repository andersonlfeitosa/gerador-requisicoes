var http = require("http");
var request = require('sync-request');
var fs = require("fs");
var cpf_cnpj = require("cpf_cnpj").CPF;
var program = require('commander');

/*
 * Configuracao dos parametros de entrada do programa.
 */
program
  .version('1.0.0')
  .option('-p, --policy <policy>', 'Policy type: life, home or auto', /^(life|home|auto)$/i, 'life')
  .option('-f, --file [file]', 'JSON file', 'life.devdp.json')
  .option('-e, --environment <environment>', 'Environment: devdp or uat', /^(devdp|uat)$/i, 'devdp')
  .option('-n, --number-requests <number>', 'Number of requests', 1)
  .option('-t, --type <type>', 'Type of requests: sync or async', /^(sync|async)$/i, 'sync');

program.on('--help', function(){
  console.log('  Defaults:');
  console.log('');
  console.log('    -p life');
  console.log('    -f life.devdp.json');
  console.log('    -e devdp');
  console.log('    -n 1');
  console.log('    -t sync');
  console.log('');
  console.log('  Examples:');
  console.log('');
  console.log('    $ node server.js -p life -e life.json -e devdp -n 10 -t sync');
  console.log('    $ node server.js -p home -e home-sample.json -e uat -n 100 -t async');
  console.log('');
});

program.parse(process.argv);

/*
 * Estatisticas de execucao 
 */
var AVG = 0;
var MAX = 0;
var MIN = 9999999;
var NUM_POL = 0;
var ASYNC_REQ = 0;


/*
 * Parametros de entrada
 */
var policy = program.policy;
var file = program.file;
var server = program.environment;
var NUMREQ = program.numberRequests;
var mode = program.type;

console.log('############################');
console.log('# Parametros para execucao #');
console.log('############################');
console.log('# Policy: %s', policy);
console.log('# File: %s', file);
console.log('# Environment: %s', server);
console.log('# Number of requests: %s', NUMREQ);
console.log('# Execution mode: %s', mode);
console.log('');


/*
 * Main
 */
fs.readFile(file, (err, data) => {
  var json = JSON.parse(data);

  for (var i = 0; i < NUMREQ; i++) {
    var item = cpf_cnpj.generate(true);

    json.params[0].draftData.accountHolder.taxID = item;
    json.params[0].draftData.periodStartDate = getDateNow();

    if (policy == "life") {
      json.params[0].draftData.lobs.aAHAandH.aandHPartys[0].coveredPerson.taxID = item;
    } else if (policy == "home") {
      json.params[0].draftData.lobs.homeowners.additionalInterests_GCS[0].contact.taxID = cpf_cnpj.generate(true);
    } else if (policy == "auto") {
      json.params[0].draftData.lobs.personalAuto.drivers[0].person.taxID = item;
    }

    var headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(json), 'utf8'),
      'Authorization': 'Basic cHU6cGFzc3dvcmQ=',
      'UserToken': 'aarmstrong',
      'Granted-Authorities': '{"id":"pravin","username":"aarmstrong","securityRealm":{"id":"pravin","realm":"default"},"grantedAuthorities":[{"id":"pravin","target":"510011410000008","authorityType":"POLICY"}]}'
    };

    if (mode == "sync") {
      doSync(headers, json);
    } else if (mode == "async") {
      doAsync(headers, json);
    }
  };

  if (mode == "sync") {
    console.log("REQS: %s - POLICIES: %s - MIN: %s - MAX: %s - AVG: %s",  NUMREQ, NUM_POL, MIN, MAX, AVG / NUMREQ);
  }

});

function doSync(headers, json) {
  if (server == "uat") {
    var endpoint = 'http://10.101.2.34/quote/quote';
  } else if (server == "devdp") {
    var endpoint = 'http://10.102.2.166/quote/quote';
  }

  var startTime = new Date().getTime();
  var res = request('POST', endpoint, {
    headers : headers, 
    json : json
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

function doAsync(headers, jsonObject) {
  var optionspost = {
    path : '/quote/quote',
    method : 'POST',
    headers : headers
  };

  if (server == "uat") {
    optionspost.host = "10.101.2.34";
  } else if (server == "devdp") {
    optionspost.host = "10.102.2.166";
  }

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

function getDateNow() {
  var month = new Date().getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  var periodStartDate = '2016-' + month + '-' + new Date().getDate() + 'T16:13:35.720-03:00';

  return periodStartDate;
}

