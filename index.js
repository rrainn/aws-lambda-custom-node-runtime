#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');
const colors = require('colors');
const archiver = require('archiver');
const rimraf = require('rimraf');

const version = require('./utils/version_cleaner')(process.argv[process.argv.length - 1]);
const nodeFolder = `node-v${version}-linux-x64`;
const runtimeName = `${nodeFolder}-lambda-runtime`;
const downloadName = `${nodeFolder}.tar.xz`;
const downloadURL = `https://nodejs.org/dist/v${version}/${downloadName}`;

function main() {
	let runtimeFileNumber;
	console.log("Getting runtime file name.");
	while (true) {
		if (!fs.existsSync(path.join(`node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`))) {
			break;
		}
		if (runtimeFileNumber) {
			runtimeFileNumber++;
		} else {
			runtimeFileNumber = 1;
		}
	}
	const nodeRunnerFile = `node_runtime${runtimeFileNumber ? `_${runtimeFileNumber}` : ""}.js`;
	console.log(`✔ Got runtime file name: ${nodeRunnerFile}.`.green);

	copyTemplates([nodeRunnerFile, 'bootstrap'])
	.then(() => replaceBootstrapStrings(version, nodeRunnerFile))
	.then(bootstrap => writeBootstrapToDisk(bootstrap))
	.then(() => makeExecutable('bootstrap'))
	.then(() => downloadFile(downloadURL, downloadName))
	.then((fileName) => unzip(fileName))
	.then(() => createRuntimeZip(nodeFolder, runtimeName))
	.then(() => houseKeeping())
	.then(() => {
		return console.log(`\n\nYour node runtime is in node-v${version}-linux-x64-lambda-runtime.zip\n`.yellow);
	})
	.catch(err => {
		console.log('Oh snap! Got an error!'.red);
		throw err;
	})
};

const houseKeeping = () => {
	return new Promise((resolve, reject) => {
		rimraf.sync(nodeFolder, { glob: false });
		fs.unlinkSync('bootstrap');
		fs.unlinkSync('node_runtime.js');
		console.log('✔ Cleaned up artifacts.'.green);
		return resolve();
	});
};

const createRuntimeZip = (nodeDir, runtimePath) => {
	return new Promise((resolve, reject) => {
		const archive = archiver('zip', { zlip: { level: 9 } });
		const output = fs.createWriteStream(`${runtimePath}.zip`);

		archive.pipe(output);
		archive.file('bootstrap', { name: 'bootstrap' });
		archive.file('node_runtime.js', { name: 'node_runtime.js' });
		archive.directory(`${nodeDir}`, runtimePath);
		archive.finalize();
	
		output.on('close', () => {
			return resolve(archive)
		});
		archive.on('error', err => reject(err));
	});
};

const copyTemplates = files => {
	return new Promise((resolve, reject) => {
		files.map(file => {
			fs.copyFile(path.join(__dirname, 'templates', file), file, () => {
				console.log(`✔ Copied ${file} template file to project directory`.green);
			}, err => {
				reject(err);
			});
		});
		
		resolve();
	});
};

function replaceBootstrapStrings(version, nodeRunnerFile) {
	return new Promise((resolve, reject) => {
		fs.readFile(`bootstrap`, 'utf8', (err, contents) => {
			if (err) reject(err);
			contents = contents
				.replace(/{{NODE_VERSION}}/g, version)
				.replace(/{{NODE_RUNNER_FILE}}/g, nodeRunnerFile);
			console.log(`✔ Replaced template strings for bootstrap file with version ${version} and runner ${nodeRunnerFile}`.green);

			resolve(contents);
		});
	})
};

const writeBootstrapToDisk = contents => {
	fs.writeFileSync('bootstrap', contents, () => {
		console.log(`✔ Wrote new bootstrap file to disk`.green);
		return Promise.resolve();
	}, err => {
		return Promise.reject(err);
	});
};

const downloadFile = (url, path) => {
	if (fs.existsSync(path)) {
		console.log(`✔ ${path} already exists. Not downloading.`.yellow);
		return Promise.resolve(path);
	}

	return axios({
		method: 'GET',
		url,
		responseType: 'arraybuffer'
	})
	.then(response => {
		fs.writeFileSync(path, response.data);
		console.log(`✔ Downloaded ${path}.`.green)
		return path
	})
	.catch(err => {
		throw err
	});
};

const unzip = file => {
	return exec(`tar -xJf ${file}`)
	.then(() => {
		console.log(`✔ Unzipped ${file}.`.green)
		return file;
	})
	.catch((err) => {
		throw err;
	});
};

const makeExecutable = file => {
	if (fs.existsSync(file)) {
		exec(`chmod 755 ${file}`)
		console.log(`✔ Made ${file} executable.`.green)
		return Promise.resolve();
	}
	return Promise.reject(new Error(`File ${file} does not exist!`.red));
};


if (process.argv.length <= 2) {
    console.log("Usage: " + __filename + " <version>  (ex: aws-lambda-custom-node-runtime 11.9.0)");
    process.exit(-1);
}

main();
