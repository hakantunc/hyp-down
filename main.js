#!/usr/bin/env node

const config = require('./config.json');
const prog = require('caporal');
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

prog
  .version('1.0.0')
  .description('Extract notes from Hypothes.is')
  .option('--days, -d <days>', 'Number of days to be fetched', prog.INT, 7)
  .action((args, options, logger) => {
    fetch(options.days);
  });

var fetch = function (days) {
  var date = new Date();
  date.setDate(date.getDate() - days);
  request(options, function (error, response, body) {
  var data = JSON.parse(body);
  var notes
    = R.compose(
        R.reduce((a, b) => a + b, ''),
        R.intersperse('\n\n'),
        R.reverse,
        R.filter(R.complement(R.isNil)),
        R.flatten,
        R.map(o => R.pluck('exact', o.target[0].selector)),
        R.filter(e => new Date(e.updated) > date)
      )(data.rows);
  console.log('## Notes from the last', days, (days == 1 ? 'day\n' : 'days\n'));
  console.log(notes);
  });
};

prog.parse(process.argv);
