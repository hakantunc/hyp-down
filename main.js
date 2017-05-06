const config = require('./config.json');
const request = require('request');
const R = require('ramda');

var options = {
  url: 'https://hypothes.is/api/search',
  auth: {bearer: config.API_TOKEN},
  qs: {
    user: config.USER,
    limit: 500
  }
};

request(options, function (error, response, body) {
  var data = JSON.parse(body);
  var f = o => R.pluck('exact', o.target[0].selector);
  var g = e => e != undefined;
  var h = (a, b) => a + b;
  var notes = R.compose(R.reduce(h, '')
         , R.intersperse('\n\n')
         , R.reverse
         , R.filter(g)
         , R.flatten
         , R.map(f))(data.rows);
  console.log(notes);
});
