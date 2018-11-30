var http = require('http');
var Buffer = require('buffer').Buffer;

function run() {
	request({
		url: process.env.AWS_LAMBDA_RUNTIME_API + '/2018-06-01/runtime/invocation/next',
	}, function(err, invoke_result) {
		if (err) {
			return request({
				url: process.env.AWS_LAMBDA_RUNTIME_API + '/2018-06-01/runtime/init/error',
				method: 'POST',
				data: err
			}, run);
		}
		var event_data = invoke_result.data;
		var request_id = invoke_result.resp.headers['lambda-runtime-aws-request-id'];

		var response = require(process.env.LAMBDA_TASK_ROOT + '/' + process.env._HANDLER.split('.')[0] + '.js')[process.env._HANDLER.split('.')[1]](JSON.parse(event_data), {}, function (err, result) {
			if (err) {
				failure(err);
			} else {
				success(result);
			}
		});
		if (response && response.then && typeof response.then === 'function') {
			response.then(success);
		}
		if (response && response.catch && typeof response.catch === 'function') {
			response.catch(failure);
		}

		function success(result) {
			request({
				url: process.env.AWS_LAMBDA_RUNTIME_API + '/2018-06-01/runtime/invocation/' + request_id + '/response',
				method: 'POST',
				data: result
			}, run);
		}
		function failure(err) {
			request({
				url: process.env.AWS_LAMBDA_RUNTIME_API + '/2018-06-01/runtime/invocation/' + request_id + '/error',
				method: 'POST',
				data: err
			}, run);
		}
	});
}
run();

function request(options, cb) {
	if (!cb) {
		cb = function(){};
	}
	if (options.data && typeof options.data === 'object') {
		options.data = JSON.stringify(options.data);
	}
	if (options.data && !options.headers) {
		options.headers = {};
	}
	if (options.data && !options.headers['Content-Length']) {
		options.headers['Content-Length'] = Buffer.byteLength(options.data);
	}
	if (options.data && !options.headers['Content-Type']) {
		options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}
	options.timeout = 1000;
	var req = http.request('http://' + options.url, options, function(resp) {
		var data = '';
		resp.on('data', function(chunk) {
			data += chunk;
		});
		resp.on('end', function() {
			cb(null, {data: data, resp: resp});
		});
	}).on('error', function(err) {
		cb(err);
	});

	if (options.data) {
		req.write(options.data);
	}
	req.end();
}
